"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { WalletActionState } from "@/lib/wallets/action-state";
import {
  applyIncomeAllocationPlanSchema,
  assignTransactionWalletSchema,
  createPurposeWalletSchema,
  incomeAllocationPlanSchema,
  updatePurposeWalletSchema,
  walletAllocationSchema,
  walletReallocationSchema,
} from "@/lib/wallets/schema";
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
function logWalletError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[wallets:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage wallets.";
const GENERIC_FAILED_MESSAGE = "That didn't work. Please try again.";

export async function createPurposeWalletAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = createPurposeWalletSchema.safeParse({
    name: readFormString(formData, "name"),
    currency: readFormString(formData, "currency") || "INR",
    icon: readFormString(formData, "icon"),
    color: readFormString(formData, "color"),
    description: readFormString(formData, "description"),
    priority: readFormString(formData, "priority") || "0",
    targetAmount: readFormString(formData, "targetAmount"),
    fundingMode: readFormString(formData, "fundingMode") || "earmarked",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: wallet, error } = await supabase.rpc("create_purpose_wallet", {
    p_name: parsed.data.name,
    p_currency: parsed.data.currency,
    ...(parsed.data.icon ? { p_icon: parsed.data.icon } : {}),
    ...(parsed.data.color ? { p_color: parsed.data.color } : {}),
    ...(parsed.data.description
      ? { p_description: parsed.data.description }
      : {}),
    p_priority: parsed.data.priority,
    ...(parsed.data.targetAmount
      ? { p_target_amount: parsed.data.targetAmount.toNumber() }
      : {}),
    p_funding_mode: parsed.data.fundingMode,
  });

  if (error || !wallet) {
    logWalletError("create", error?.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  redirect(`/app/wallets/${wallet.id}?created=1`);
}

export async function updatePurposeWalletAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const walletId = readFormString(formData, "walletId");
  if (!walletId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = updatePurposeWalletSchema.safeParse({
    name: readFormString(formData, "name"),
    icon: readFormString(formData, "icon"),
    color: readFormString(formData, "color"),
    description: readFormString(formData, "description"),
    priority: readFormString(formData, "priority") || "0",
    targetAmount: readFormString(formData, "targetAmount"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("update_purpose_wallet", {
    p_wallet_id: walletId,
    p_name: parsed.data.name,
    ...(parsed.data.icon ? { p_icon: parsed.data.icon } : {}),
    ...(parsed.data.color ? { p_color: parsed.data.color } : {}),
    ...(parsed.data.description
      ? { p_description: parsed.data.description }
      : {}),
    p_priority: parsed.data.priority,
    ...(parsed.data.targetAmount
      ? { p_target_amount: parsed.data.targetAmount.toNumber() }
      : {}),
  });

  if (error) {
    logWalletError("update", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/wallets/${walletId}`);
  revalidatePath("/app/wallets");

  return { status: "success", message: "Wallet updated." };
}

export async function setPurposeWalletArchivedAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const walletId = readFormString(formData, "walletId");
  const archived = readFormString(formData, "archived") === "true";
  if (!walletId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_purpose_wallet_archived", {
    p_wallet_id: walletId,
    p_archived: archived,
  });

  if (error) {
    logWalletError("archive", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/wallets/${walletId}`);
  revalidatePath("/app/wallets");

  return {
    status: "success",
    message: archived ? "Wallet archived." : "Wallet restored.",
  };
}

export async function allocateToPurposeWalletAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const walletId = readFormString(formData, "walletId");
  if (!walletId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = walletAllocationSchema.safeParse({
    amount: readFormString(formData, "amount"),
    memo: readFormString(formData, "memo"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("allocate_to_purpose_wallet", {
    p_wallet_id: walletId,
    p_amount: parsed.data.amount.toNumber(),
    ...(parsed.data.memo ? { p_memo: parsed.data.memo } : {}),
  });

  if (error) {
    logWalletError("allocate", error.code);
    return {
      status: "error",
      message:
        error.code === "22023"
          ? "That would allocate more than you have available."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  revalidatePath(`/app/wallets/${walletId}`);
  revalidatePath("/app/wallets");

  return { status: "success", message: "Money allocated to wallet." };
}

export async function releasePurposeWalletAllocationAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const walletId = readFormString(formData, "walletId");
  if (!walletId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = walletAllocationSchema.safeParse({
    amount: readFormString(formData, "amount"),
    memo: readFormString(formData, "memo"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("release_purpose_wallet_allocation", {
    p_wallet_id: walletId,
    p_amount: parsed.data.amount.toNumber(),
    ...(parsed.data.memo ? { p_memo: parsed.data.memo } : {}),
  });

  if (error) {
    logWalletError("release", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/wallets/${walletId}`);
  revalidatePath("/app/wallets");

  return { status: "success", message: "Allocation released." };
}

export async function reallocatePurposeWalletAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = walletReallocationSchema.safeParse({
    fromWalletId: readFormString(formData, "fromWalletId"),
    toWalletId: readFormString(formData, "toWalletId"),
    amount: readFormString(formData, "amount"),
    memo: readFormString(formData, "memo"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reallocate_purpose_wallet", {
    p_from_wallet_id: parsed.data.fromWalletId,
    p_to_wallet_id: parsed.data.toWalletId,
    p_amount: parsed.data.amount.toNumber(),
    ...(parsed.data.memo ? { p_memo: parsed.data.memo } : {}),
  });

  if (error) {
    logWalletError("reallocate", error.code);
    return {
      status: "error",
      message:
        error.code === "22023"
          ? "That source wallet doesn't have enough allocated."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  revalidatePath(`/app/wallets/${parsed.data.fromWalletId}`);
  revalidatePath(`/app/wallets/${parsed.data.toWalletId}`);
  revalidatePath("/app/wallets");

  return { status: "success", message: "Money moved between wallets." };
}

export async function assignTransactionToPurposeWalletAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = assignTransactionWalletSchema.safeParse({
    transactionId: readFormString(formData, "transactionId"),
    walletId: readFormString(formData, "walletId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Choose a valid wallet.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("assign_transaction_to_purpose_wallet", {
    p_transaction_id: parsed.data.transactionId,
    p_wallet_id: parsed.data.walletId,
  });

  if (error) {
    logWalletError("assign", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/transactions/${parsed.data.transactionId}`);
  revalidatePath(`/app/wallets/${parsed.data.walletId}`);

  return { status: "success", message: "Transaction assigned to wallet." };
}

export async function unassignTransactionPurposeWalletAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const transactionId = readFormString(formData, "transactionId");
  if (!transactionId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unassign_transaction_purpose_wallet", {
    p_transaction_id: transactionId,
  });

  if (error) {
    logWalletError("unassign", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/transactions/${transactionId}`);
  revalidatePath("/app/wallets");

  return { status: "success", message: "Wallet assignment removed." };
}

export async function saveIncomeAllocationPlanAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const rawLines = readFormString(formData, "lines");
  let linesInput: unknown;
  try {
    linesInput = JSON.parse(rawLines || "[]");
  } catch {
    return { status: "error", message: "Invalid allocation lines." };
  }

  const planId = readFormString(formData, "planId") || undefined;

  const parsed = incomeAllocationPlanSchema.safeParse({
    name: readFormString(formData, "name"),
    allocationMode: readFormString(formData, "allocationMode"),
    effectiveDate: readFormString(formData, "effectiveDate"),
    endDate: readFormString(formData, "endDate"),
    lines: linesInput,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: plan, error } = await supabase.rpc(
    "save_income_allocation_plan",
    {
      p_name: parsed.data.name,
      p_allocation_mode: parsed.data.allocationMode,
      p_effective_date: parsed.data.effectiveDate,
      p_lines: parsed.data.lines.map((line, index) => ({
        wallet_id: line.walletId,
        line_order: index,
        ...(line.percentage !== undefined
          ? { percentage: line.percentage.toNumber() }
          : {}),
        ...(line.fixedAmount !== undefined
          ? { fixed_amount: line.fixedAmount.toNumber() }
          : {}),
      })),
      ...(planId ? { p_plan_id: planId } : {}),
      ...(parsed.data.endDate ? { p_end_date: parsed.data.endDate } : {}),
    },
  );

  if (error || !plan) {
    logWalletError("save-plan", error?.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  redirect(`/app/allocation-plans?saved=1`);
}

export async function setIncomeAllocationPlanStatusAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const planId = readFormString(formData, "planId");
  const status = readFormString(formData, "status");
  if (!planId || !status) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_income_allocation_plan_status", {
    p_plan_id: planId,
    p_status: status,
  });

  if (error) {
    logWalletError("plan-status", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath("/app/allocation-plans");

  return { status: "success", message: "Plan updated." };
}

export async function applyIncomeAllocationPlanToTransactionAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = applyIncomeAllocationPlanSchema.safeParse({
    planId: readFormString(formData, "planId"),
    transactionId: readFormString(formData, "transactionId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Choose a valid plan.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "apply_income_allocation_plan_to_transaction",
    {
      p_plan_id: parsed.data.planId,
      p_transaction_id: parsed.data.transactionId,
    },
  );

  if (error) {
    logWalletError("apply-plan", error.code);
    return {
      status: "error",
      message:
        error.code === "23505"
          ? "This plan has already been applied to that income transaction."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  revalidatePath(`/app/transactions/${parsed.data.transactionId}`);
  revalidatePath("/app/wallets");

  return { status: "success", message: "Income allocated." };
}

export async function reverseIncomeAllocationApplicationAction(
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const applicationId = readFormString(formData, "applicationId");
  if (!applicationId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "reverse_income_allocation_application",
    { p_application_id: applicationId },
  );

  if (error) {
    logWalletError("reverse-application", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath("/app/allocation-plans");
  revalidatePath("/app/wallets");

  return { status: "success", message: "Allocation reversed." };
}
