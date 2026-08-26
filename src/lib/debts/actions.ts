"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { DebtActionState } from "@/lib/debts/action-state";
import {
  changeDebtRateSchema,
  createDebtSchema,
  debtStatusSchema,
  recordDebtPaymentSchema,
  recordDebtProceedsSchema,
  regenerateScheduleSchema,
} from "@/lib/debts/schema";
import { istCalendarDateToUtcIso } from "@/lib/dates/timezone";
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
function logDebtError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[debts:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage debts.";
const GENERIC_FAILED_MESSAGE = "That didn't work. Please try again.";

export async function createDebtAction(
  _prevState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = createDebtSchema.safeParse({
    name: readFormString(formData, "name"),
    debtType: readFormString(formData, "debtType"),
    liabilityAccountId: readFormString(formData, "liabilityAccountId"),
    originalPrincipal: readFormString(formData, "originalPrincipal"),
    startDate: readFormString(formData, "startDate"),
    currency: readFormString(formData, "currency") || "INR",
    annualInterestRate: readFormString(formData, "annualInterestRate"),
    interestMethod:
      readFormString(formData, "interestMethod") || "reducing_balance",
    paymentFrequency: readFormString(formData, "paymentFrequency") || "monthly",
    contractualEndDate: readFormString(formData, "contractualEndDate"),
    minimumPayment: readFormString(formData, "minimumPayment"),
    dueDay: readFormString(formData, "dueDay"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: debt, error } = await supabase.rpc("create_debt", {
    p_name: parsed.data.name,
    p_debt_type: parsed.data.debtType,
    p_liability_account_id: parsed.data.liabilityAccountId,
    p_original_principal: parsed.data.originalPrincipal.toNumber(),
    p_start_date: parsed.data.startDate,
    p_currency: parsed.data.currency,
    p_annual_interest_rate: parsed.data.annualInterestRate.toNumber(),
    p_interest_method: parsed.data.interestMethod,
    p_payment_frequency: parsed.data.paymentFrequency,
    ...(parsed.data.contractualEndDate
      ? { p_contractual_end_date: parsed.data.contractualEndDate }
      : {}),
    ...(parsed.data.minimumPayment
      ? { p_minimum_payment: parsed.data.minimumPayment.toNumber() }
      : {}),
    ...(parsed.data.dueDay !== undefined
      ? { p_due_day: parsed.data.dueDay }
      : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
  });

  if (error || !debt) {
    logDebtError("create", error?.code);
    return {
      status: "error",
      message:
        error?.code === "23505"
          ? "That account is already linked to another debt."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  redirect(`/app/debts/${debt.id}?created=1`);
}

export async function recordDebtProceedsAction(
  _prevState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const debtId = readFormString(formData, "debtId");
  if (!debtId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = recordDebtProceedsSchema.safeParse({
    receivingAccountId: readFormString(formData, "receivingAccountId"),
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
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
  const { error } = await supabase.rpc("record_debt_proceeds", {
    p_debt_id: debtId,
    p_receiving_account_id: parsed.data.receivingAccountId,
    p_amount: parsed.data.amount.toNumber(),
    p_occurred_at: istCalendarDateToUtcIso(parsed.data.occurredOn),
    p_idempotency_key: parsed.data.idempotencyKey,
  });

  if (error) {
    logDebtError("proceeds", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/debts/${debtId}`);
  revalidatePath("/app/debts");

  return { status: "success", message: "Loan proceeds recorded." };
}

export async function changeDebtRateAction(
  _prevState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const debtId = readFormString(formData, "debtId");
  if (!debtId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = changeDebtRateSchema.safeParse({
    annualInterestRate: readFormString(formData, "annualInterestRate"),
    effectiveDate: readFormString(formData, "effectiveDate"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("change_debt_rate", {
    p_debt_id: debtId,
    p_annual_interest_rate: parsed.data.annualInterestRate.toNumber(),
    p_effective_date: parsed.data.effectiveDate,
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
  });

  if (error) {
    logDebtError("rate", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/debts/${debtId}`);

  return { status: "success", message: "Interest rate updated." };
}

export async function regenerateDebtPaymentScheduleAction(
  _prevState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const debtId = readFormString(formData, "debtId");
  if (!debtId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = regenerateScheduleSchema.safeParse({
    installmentCount: readFormString(formData, "installmentCount"),
    installmentPayment: readFormString(formData, "installmentPayment"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("regenerate_debt_payment_schedule", {
    p_debt_id: debtId,
    p_installment_count: parsed.data.installmentCount,
    ...(parsed.data.installmentPayment
      ? { p_installment_payment: parsed.data.installmentPayment.toNumber() }
      : {}),
  });

  if (error) {
    logDebtError("schedule", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/debts/${debtId}`);

  return { status: "success", message: "Payment schedule generated." };
}

export async function recordDebtPaymentAction(
  _prevState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const debtId = readFormString(formData, "debtId");
  if (!debtId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const parsed = recordDebtPaymentSchema.safeParse({
    principalAmount: readFormString(formData, "principalAmount") || "0",
    interestAmount: readFormString(formData, "interestAmount") || "0",
    feesAmount: readFormString(formData, "feesAmount") || "0",
    paymentAccountId: readFormString(formData, "paymentAccountId"),
    effectiveDate: readFormString(formData, "effectiveDate"),
    idempotencyKey: readFormString(formData, "idempotencyKey"),
    paymentType: readFormString(formData, "paymentType") || "scheduled",
    scheduleRowId: readFormString(formData, "scheduleRowId"),
    prepaymentAssumption: readFormString(formData, "prepaymentAssumption"),
    allowOverpayment: readFormString(formData, "allowOverpayment") || "false",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_debt_payment", {
    p_debt_id: debtId,
    p_principal_amount: parsed.data.principalAmount.toNumber(),
    p_interest_amount: parsed.data.interestAmount.toNumber(),
    p_fees_amount: parsed.data.feesAmount.toNumber(),
    p_payment_account_id: parsed.data.paymentAccountId,
    p_effective_date: parsed.data.effectiveDate,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_payment_type: parsed.data.paymentType,
    ...(parsed.data.scheduleRowId
      ? { p_schedule_row_id: parsed.data.scheduleRowId }
      : {}),
    ...(parsed.data.prepaymentAssumption
      ? { p_prepayment_assumption: parsed.data.prepaymentAssumption }
      : {}),
    p_allow_overpayment: parsed.data.allowOverpayment,
  });

  if (error) {
    logDebtError("payment", error.code);
    return {
      status: "error",
      message:
        error.code === "22023"
          ? "That principal payment exceeds the outstanding balance."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  revalidatePath(`/app/debts/${debtId}`);
  revalidatePath("/app/debts");
  revalidatePath("/app/transactions");

  return { status: "success", message: "Payment recorded." };
}

export async function setDebtStatusAction(
  _prevState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const debtId = readFormString(formData, "debtId");
  const parsedStatus = debtStatusSchema.safeParse(
    readFormString(formData, "status"),
  );
  if (!debtId || !parsedStatus.success) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_debt_status", {
    p_debt_id: debtId,
    p_status: parsedStatus.data,
  });

  if (error) {
    logDebtError("status", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath(`/app/debts/${debtId}`);
  revalidatePath("/app/debts");

  return { status: "success", message: "Debt status updated." };
}
