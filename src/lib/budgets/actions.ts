"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import type { BudgetActionState } from "@/lib/budgets/action-state";
import {
  copyBudgetPeriodSchema,
  saveBudgetAllocationsSchema,
} from "@/lib/budgets/schema";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Logs only a Postgrest error code, never its message (which can echo back data). */
function logBudgetError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[budgets:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage budgets.";
const SAVE_FAILED_MESSAGE = "We couldn't save that budget. Please try again.";
const COPY_FAILED_MESSAGE = "We couldn't copy that budget. Please try again.";

/** Every per-category amount input in BudgetAllocationsForm is named `amount:<categoryId>`, so a variable-length category list needs no client-side array serialization. */
const AMOUNT_FIELD_PREFIX = "amount:";

/**
 * Saves every category allocation for a budget period atomically through
 * public.save_budget_allocations (see supabase/migrations) — a full
 * delete-then-reinsert in one call, so there is no window where only some
 * categories have been saved.
 */
export async function saveBudgetAllocationsAction(
  _prevState: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const allocations: { categoryId: string; plannedAmount: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(AMOUNT_FIELD_PREFIX) && typeof value === "string") {
      allocations.push({
        categoryId: key.slice(AMOUNT_FIELD_PREFIX.length),
        plannedAmount: value,
      });
    }
  }

  const parsed = saveBudgetAllocationsSchema.safeParse({
    budgetPeriodId: readFormString(formData, "budgetPeriodId"),
    plannedIncome: readFormString(formData, "plannedIncome") || undefined,
    allocations,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("save_budget_allocations", {
    p_budget_period_id: parsed.data.budgetPeriodId,
    p_allocations: parsed.data.allocations.map((entry) => ({
      category_id: entry.categoryId,
      planned_amount: entry.plannedAmount.toFixed(4),
    })),
    ...(parsed.data.plannedIncome !== undefined
      ? { p_planned_income: parsed.data.plannedIncome.toNumber() }
      : {}),
  });

  if (error) {
    logBudgetError("save-allocations", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  revalidatePath("/app/budgets");

  return { status: "success", message: "Budget saved." };
}

/** Copies a previous period's allocations into a target period through public.copy_budget_period — idempotent "fill in missing categories," never overwrites an existing target allocation. */
export async function copyBudgetPeriodAction(
  _prevState: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = copyBudgetPeriodSchema.safeParse({
    sourcePeriodMonth: readFormString(formData, "sourcePeriodMonth"),
    targetPeriodMonth: readFormString(formData, "targetPeriodMonth"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("copy_budget_period", {
    p_source_period_month: parsed.data.sourcePeriodMonth,
    p_target_period_month: parsed.data.targetPeriodMonth,
  });

  if (error) {
    logBudgetError("copy", error.code);
    if (error.code === "P0002") {
      return {
        status: "error",
        message: "That month has no budget to copy yet.",
      };
    }
    return { status: "error", message: COPY_FAILED_MESSAGE };
  }

  revalidatePath("/app/budgets");

  return { status: "success", message: "Budget copied." };
}
