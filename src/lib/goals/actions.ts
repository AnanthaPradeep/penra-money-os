"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { istCalendarDateToUtcIso } from "@/lib/dates/timezone";
import { getExpenseByCategory } from "@/lib/ledger/queries";
import type { GoalActionState } from "@/lib/goals/action-state";
import {
  createFinancialGoalSchema,
  goalContributionAllocationSchema,
  goalContributionTransferSchema,
  goalMilestoneSchema,
  goalStatusSchema,
  updateFinancialGoalSchema,
} from "@/lib/goals/schema";
import { Decimal } from "@/lib/money/decimal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Whole calendar months between two "YYYY-MM-DD" dates, inclusive-ish (at least 1) — used only to average a category-expense total into a monthly figure. */
function monthsBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;
  return Math.max(1, months);
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
function logGoalError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[goals:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage goals.";
const GENERIC_FAILED_MESSAGE = "That didn't work. Please try again.";

export async function createFinancialGoalAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = createFinancialGoalSchema.safeParse({
    name: readFormString(formData, "name"),
    goalType: readFormString(formData, "goalType"),
    currency: readFormString(formData, "currency") || "INR",
    targetAmount: readFormString(formData, "targetAmount"),
    targetDate: readFormString(formData, "targetDate"),
    startDate: readFormString(formData, "startDate"),
    priority: readFormString(formData, "priority") || "0",
    fundingMode: readFormString(formData, "fundingMode") || "earmarked",
    purposeWalletId: readFormString(formData, "purposeWalletId"),
    notes: readFormString(formData, "notes"),
    efTargetMethod: readFormString(formData, "efTargetMethod"),
    efTargetMonths: readFormString(formData, "efTargetMonths"),
    efEssentialMonthlyExpense: readFormString(
      formData,
      "efEssentialMonthlyExpense",
    ),
    efEssentialCategoryIds: formData
      .getAll("efEssentialCategoryIds")
      .filter((v): v is string => typeof v === "string" && v.length > 0),
    efEssentialPeriodStart: readFormString(formData, "efEssentialPeriodStart"),
    efEssentialPeriodEnd: readFormString(formData, "efEssentialPeriodEnd"),
    sfContributionFrequency: readFormString(
      formData,
      "sfContributionFrequency",
    ),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  // The category-based essential-expense method: the user selects which
  // expense categories are "essential" and a lookback period, and this
  // sums their real, already-recorded spend over that period (via the
  // same public.dashboard_expense_by_category RPC the dashboard uses,
  // never a second definition of "category expense total") — the user
  // still explicitly confirms this became the goal's target by submitting
  // the form; nothing here infers essential-ness on its own.
  let computedEssentialExpense = parsed.data.efEssentialMonthlyExpense;
  if (
    parsed.data.efTargetMethod === "months_of_expenses" &&
    computedEssentialExpense === undefined &&
    parsed.data.efEssentialCategoryIds &&
    parsed.data.efEssentialCategoryIds.length > 0 &&
    parsed.data.efEssentialPeriodStart &&
    parsed.data.efEssentialPeriodEnd
  ) {
    const breakdown = await getExpenseByCategory(
      supabase,
      parsed.data.efEssentialPeriodStart,
      parsed.data.efEssentialPeriodEnd,
    );
    const selected = new Set(parsed.data.efEssentialCategoryIds);
    const total = breakdown
      .filter((row) => row.categoryId && selected.has(row.categoryId))
      .reduce((sum, row) => sum.plus(row.totalAmount), new Decimal(0));

    const monthsInPeriod = Math.max(
      1,
      monthsBetween(
        parsed.data.efEssentialPeriodStart,
        parsed.data.efEssentialPeriodEnd,
      ),
    );
    computedEssentialExpense = total
      .dividedBy(monthsInPeriod)
      .toDecimalPlaces(4);

    if (total.isZero()) {
      return {
        status: "error",
        message:
          "No expenses were found in the selected categories for that period. Enter an amount manually instead, or choose a different period.",
        fieldErrors: {
          efEssentialMonthlyExpense: "No matching expenses found.",
        },
      };
    }
  }

  const { data: goal, error } = await supabase.rpc("create_financial_goal", {
    p_name: parsed.data.name,
    p_goal_type: parsed.data.goalType,
    p_target_amount: parsed.data.targetAmount.toNumber(),
    p_currency: parsed.data.currency,
    ...(parsed.data.targetDate
      ? { p_target_date: parsed.data.targetDate }
      : {}),
    ...(parsed.data.startDate ? { p_start_date: parsed.data.startDate } : {}),
    p_priority: parsed.data.priority,
    p_funding_mode: parsed.data.fundingMode,
    ...(parsed.data.purposeWalletId
      ? { p_purpose_wallet_id: parsed.data.purposeWalletId }
      : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
    ...(parsed.data.efTargetMethod
      ? { p_ef_target_method: parsed.data.efTargetMethod }
      : {}),
    ...(parsed.data.efTargetMonths !== undefined
      ? { p_ef_target_months: parsed.data.efTargetMonths }
      : {}),
    ...(computedEssentialExpense !== undefined
      ? { p_ef_essential_monthly_expense: computedEssentialExpense.toNumber() }
      : {}),
    ...(parsed.data.efEssentialCategoryIds &&
    parsed.data.efEssentialCategoryIds.length > 0
      ? { p_ef_essential_category_ids: parsed.data.efEssentialCategoryIds }
      : {}),
    ...(parsed.data.efEssentialPeriodStart
      ? { p_ef_essential_period_start: parsed.data.efEssentialPeriodStart }
      : {}),
    ...(parsed.data.efEssentialPeriodEnd
      ? { p_ef_essential_period_end: parsed.data.efEssentialPeriodEnd }
      : {}),
    ...(parsed.data.sfContributionFrequency
      ? { p_sf_contribution_frequency: parsed.data.sfContributionFrequency }
      : {}),
  });

  if (error || !goal) {
    logGoalError("create", error?.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  redirect(`/app/goals/${goal.id}?created=1`);
}

export async function updateFinancialGoalAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const goalId = readFormString(formData, "goalId");
  if (!goalId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = updateFinancialGoalSchema.safeParse({
    name: readFormString(formData, "name"),
    targetAmount: readFormString(formData, "targetAmount"),
    targetDate: readFormString(formData, "targetDate"),
    priority: readFormString(formData, "priority") || "0",
    notes: readFormString(formData, "notes"),
    efTargetMethod: readFormString(formData, "efTargetMethod"),
    efTargetMonths: readFormString(formData, "efTargetMonths"),
    efEssentialMonthlyExpense: readFormString(
      formData,
      "efEssentialMonthlyExpense",
    ),
    sfContributionFrequency: readFormString(
      formData,
      "sfContributionFrequency",
    ),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_financial_goal", {
    p_goal_id: goalId,
    p_name: parsed.data.name,
    p_target_amount: parsed.data.targetAmount.toNumber(),
    ...(parsed.data.targetDate
      ? { p_target_date: parsed.data.targetDate }
      : {}),
    p_priority: parsed.data.priority,
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
    ...(parsed.data.efTargetMethod
      ? { p_ef_target_method: parsed.data.efTargetMethod }
      : {}),
    ...(parsed.data.efTargetMonths !== undefined
      ? { p_ef_target_months: parsed.data.efTargetMonths }
      : {}),
    ...(parsed.data.efEssentialMonthlyExpense !== undefined
      ? {
          p_ef_essential_monthly_expense:
            parsed.data.efEssentialMonthlyExpense.toNumber(),
        }
      : {}),
    ...(parsed.data.sfContributionFrequency
      ? { p_sf_contribution_frequency: parsed.data.sfContributionFrequency }
      : {}),
  });

  if (error) {
    logGoalError("update", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/goals/${goalId}`);
  revalidatePath("/app/goals");

  return { status: "success", message: "Goal updated." };
}

export async function setFinancialGoalStatusAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const goalId = readFormString(formData, "goalId");
  const parsedStatus = goalStatusSchema.safeParse(
    readFormString(formData, "status"),
  );
  if (!goalId || !parsedStatus.success) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_financial_goal_status", {
    p_goal_id: goalId,
    p_status: parsedStatus.data,
  });

  if (error) {
    logGoalError("status", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/goals/${goalId}`);
  revalidatePath("/app/goals");

  return { status: "success", message: "Goal status updated." };
}

export async function linkGoalAccountAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const goalId = readFormString(formData, "goalId");
  const accountId = readFormString(formData, "accountId");
  if (!goalId || !accountId) {
    return { status: "error", message: "Choose an account." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("link_goal_account", {
    p_goal_id: goalId,
    p_account_id: accountId,
  });

  if (error) {
    logGoalError("link-account", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/goals/${goalId}`);

  return { status: "success", message: "Account linked to goal." };
}

export async function setGoalLinkedRecurringItemAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const goalId = readFormString(formData, "goalId");
  const recurringItemId = readFormString(formData, "recurringItemId");
  if (!goalId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_goal_linked_recurring_item", {
    p_goal_id: goalId,
    ...(recurringItemId ? { p_recurring_item_id: recurringItemId } : {}),
  });

  if (error) {
    logGoalError("link-recurring-item", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/goals/${goalId}`);

  return {
    status: "success",
    message: recurringItemId
      ? "Recurring item linked."
      : "Recurring item link removed.",
  };
}

export async function unlinkGoalAccountAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const goalId = readFormString(formData, "goalId");
  const accountId = readFormString(formData, "accountId");
  if (!goalId || !accountId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unlink_goal_account", {
    p_goal_id: goalId,
    p_account_id: accountId,
  });

  if (error) {
    logGoalError("unlink-account", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/goals/${goalId}`);

  return { status: "success", message: "Account unlinked." };
}

export async function saveGoalMilestoneAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const goalId = readFormString(formData, "goalId");
  if (!goalId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = goalMilestoneSchema.safeParse({
    name: readFormString(formData, "name"),
    targetAmount: readFormString(formData, "targetAmount"),
    achieved: readFormString(formData, "achieved") || "false",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_goal_milestone", {
    p_goal_id: goalId,
    p_name: parsed.data.name,
    p_target_amount: parsed.data.targetAmount.toNumber(),
    p_achieved: parsed.data.achieved,
  });

  if (error) {
    logGoalError("milestone", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/goals/${goalId}`);

  return { status: "success", message: "Milestone saved." };
}

export async function recordGoalContributionAllocationAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const goalId = readFormString(formData, "goalId");
  if (!goalId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = goalContributionAllocationSchema.safeParse({
    amount: readFormString(formData, "amount"),
    direction: readFormString(formData, "direction"),
    notes: readFormString(formData, "notes"),
    idempotencyKey: readFormString(formData, "idempotencyKey"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_goal_contribution_allocation", {
    p_goal_id: goalId,
    p_amount: parsed.data.amount.toNumber(),
    p_direction: parsed.data.direction,
    p_idempotency_key: parsed.data.idempotencyKey,
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
  });

  if (error) {
    logGoalError("contribution-allocation", error.code);
    return {
      status: "error",
      message:
        error.code === "22023"
          ? "That would allocate more than you have available."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  revalidatePath(`/app/goals/${goalId}`);
  revalidatePath("/app/goals");

  return {
    status: "success",
    message:
      parsed.data.direction === "contribution"
        ? "Contribution recorded."
        : "Withdrawal recorded.",
  };
}

export async function recordGoalContributionTransferAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const goalId = readFormString(formData, "goalId");
  if (!goalId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = goalContributionTransferSchema.safeParse({
    fromAccountId: readFormString(formData, "fromAccountId"),
    toAccountId: readFormString(formData, "toAccountId"),
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
    notes: readFormString(formData, "notes"),
    idempotencyKey: readFormString(formData, "idempotencyKey"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_goal_contribution_transfer", {
    p_goal_id: goalId,
    p_from_account_id: parsed.data.fromAccountId,
    p_to_account_id: parsed.data.toAccountId,
    p_amount: parsed.data.amount.toNumber(),
    p_occurred_at: istCalendarDateToUtcIso(parsed.data.occurredOn),
    p_idempotency_key: parsed.data.idempotencyKey,
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
  });

  if (error) {
    logGoalError("contribution-transfer", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/goals/${goalId}`);
  revalidatePath("/app/goals");
  revalidatePath("/app/transactions");

  return { status: "success", message: "Contribution recorded." };
}
