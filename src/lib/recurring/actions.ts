"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { istCalendarDateToUtcIso } from "@/lib/dates/timezone";
import { transactionDateSchema } from "@/lib/dates/schema";
import {
  buildCreditCardPurchaseEntries,
  buildExpenseEntries,
  buildIncomeEntries,
  buildTransferEntries,
  toEntriesPayload,
} from "@/lib/ledger/entry-builder";
import { positiveMoneyInputSchema } from "@/lib/money/schema";
import type { RecurringActionState } from "@/lib/recurring/action-state";
import {
  recurringItemSchema,
  updateRecurringItemSchema,
} from "@/lib/recurring/schema";
import { RECURRING_ITEM_STATUSES } from "@/lib/recurring/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOneOf } from "@/lib/types/literal";

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
function logRecurringError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[recurring:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE =
  "You need to sign in again to manage recurring items.";
const CREATE_FAILED_MESSAGE =
  "We couldn't create that recurring item. Please try again.";
const UPDATE_FAILED_MESSAGE = "We couldn't save that change. Please try again.";
const STATUS_FAILED_MESSAGE =
  "We couldn't update that recurring item. Please try again.";
const PAYMENT_FAILED_MESSAGE =
  "We couldn't record that payment. Please try again.";
const LINK_FAILED_MESSAGE =
  "We couldn't link that transaction. Please try again.";
const SKIP_FAILED_MESSAGE =
  "We couldn't skip that occurrence. Please try again.";
const RETRY_FAILED_MESSAGE =
  "We couldn't retry that occurrence. Please try again.";

/** Creates a subscription, bill, recurring income, or recurring transfer through public.create_recurring_item (see supabase/migrations), which also generates its first 60 days of occurrences atomically. */
export async function createRecurringItemAction(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const kind = readFormString(formData, "kind");
  const raw: Record<string, string> = {
    kind,
    name: readFormString(formData, "name"),
    amount: readFormString(formData, "amount"),
    frequency: readFormString(formData, "frequency"),
    intervalCount: readFormString(formData, "intervalCount") || "1",
    startDate: readFormString(formData, "startDate"),
    endDate: readFormString(formData, "endDate"),
    notes: readFormString(formData, "notes"),
    processingMode: readFormString(formData, "processingMode"),
    sourceAccountId: readFormString(formData, "sourceAccountId"),
    destinationAccountId: readFormString(formData, "destinationAccountId"),
    categoryId: readFormString(formData, "categoryId"),
    payeeId: readFormString(formData, "payeeId"),
    trialEndDate: readFormString(formData, "trialEndDate"),
  };

  const parsed = recurringItemSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const data = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: item, error } = await supabase.rpc("create_recurring_item", {
    p_name: data.name,
    p_kind: data.kind,
    p_amount: data.amount.toNumber(),
    p_currency: "INR",
    p_start_date: data.startDate,
    p_frequency: data.frequency,
    p_interval_count: data.intervalCount,
    p_processing_mode: data.processingMode,
    ...("sourceAccountId" in data
      ? { p_source_account_id: data.sourceAccountId }
      : {}),
    ...("destinationAccountId" in data
      ? { p_destination_account_id: data.destinationAccountId }
      : {}),
    ...("categoryId" in data ? { p_category_id: data.categoryId } : {}),
    ...("payeeId" in data && data.payeeId ? { p_payee_id: data.payeeId } : {}),
    ...(data.notes ? { p_notes: data.notes } : {}),
    ...(data.endDate ? { p_end_date: data.endDate } : {}),
    ...("trialEndDate" in data && data.trialEndDate
      ? { p_trial_end_date: data.trialEndDate }
      : {}),
  });

  if (error || !item) {
    logRecurringError("create", error?.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  redirect(`/app/recurring/${item.id}?created=1`);
}

/** Edits a recurring item's revisable fields through public.update_recurring_item — see supabase/migrations for exactly which fields, and why kind/accounts/currency/start date are fixed after creation. */
export async function updateRecurringItemAction(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const recurringItemId = readFormString(formData, "recurringItemId");
  if (!recurringItemId) {
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  const parsed = updateRecurringItemSchema.safeParse({
    name: readFormString(formData, "name"),
    amount: readFormString(formData, "amount"),
    categoryId: readFormString(formData, "categoryId"),
    payeeId: readFormString(formData, "payeeId"),
    notes: readFormString(formData, "notes"),
    endDate: readFormString(formData, "endDate"),
    frequency: readFormString(formData, "frequency"),
    intervalCount: readFormString(formData, "intervalCount") || "1",
    processingMode: readFormString(formData, "processingMode"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("update_recurring_item", {
    p_id: recurringItemId,
    p_name: parsed.data.name,
    p_amount: parsed.data.amount.toNumber(),
    p_frequency: parsed.data.frequency,
    p_interval_count: parsed.data.intervalCount,
    p_processing_mode: parsed.data.processingMode,
    ...(parsed.data.categoryId
      ? { p_category_id: parsed.data.categoryId }
      : {}),
    ...(parsed.data.payeeId ? { p_payee_id: parsed.data.payeeId } : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
    ...(parsed.data.endDate ? { p_end_date: parsed.data.endDate } : {}),
  });

  if (error) {
    logRecurringError("update", error.code);
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Recurring item updated." };
}

/** Pauses, resumes, cancels, or archives a recurring item through public.set_recurring_item_status — see supabase/migrations for the allowed transitions. */
export async function setRecurringItemStatusAction(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const recurringItemId = readFormString(formData, "recurringItemId");
  const status = readFormString(formData, "status");
  if (!recurringItemId || !isOneOf(status, RECURRING_ITEM_STATUSES)) {
    return { status: "error", message: STATUS_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("set_recurring_item_status", {
    p_id: recurringItemId,
    p_status: status,
  });

  if (error) {
    logRecurringError("set-status", error.code);
    return { status: "error", message: STATUS_FAILED_MESSAGE };
  }

  const labels: Record<string, string> = {
    active: "Recurring item resumed.",
    paused: "Recurring item paused.",
    cancelled: "Recurring item cancelled.",
    archived: "Recurring item archived.",
  };

  return {
    status: "success",
    message: labels[status] ?? "Recurring item updated.",
  };
}

const recordPaymentSchema = z.object({
  occurrenceId: z.uuid(),
  itemKind: z.enum(["bill", "subscription", "income", "transfer"]),
  accountId: z.uuid("Choose an account."),
  amount: positiveMoneyInputSchema,
  occurredOn: transactionDateSchema,
  categoryId: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.uuid()])),
  payeeId: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.uuid()])),
  notes: z.string().optional(),
});

/**
 * Records a manual payment for a due reminder_only occurrence through
 * public.post_occurrence_payment, reusing exactly the same entry-builder
 * helpers the regular transaction forms use (src/lib/ledger/entry-builder.ts)
 * — never a separate, weaker posting path. For a transfer occurrence, both
 * accounts are read back from the recurring item itself (never trusted
 * from client input) via the `sourceAccountId`/`destinationAccountId`
 * hidden fields the composer already renders from server-fetched data.
 */
export async function recordOccurrencePaymentAction(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const itemKind = readFormString(formData, "itemKind");
  const supabase = await createSupabaseServerClient();

  if (itemKind === "transfer") {
    const parsed = z
      .object({
        occurrenceId: z.uuid(),
        sourceAccountId: z.uuid(),
        destinationAccountId: z.uuid(),
        amount: positiveMoneyInputSchema,
        occurredOn: transactionDateSchema,
        notes: z.string().optional(),
      })
      .safeParse({
        occurrenceId: readFormString(formData, "occurrenceId"),
        sourceAccountId: readFormString(formData, "sourceAccountId"),
        destinationAccountId: readFormString(formData, "destinationAccountId"),
        amount: readFormString(formData, "amount"),
        occurredOn: readFormString(formData, "occurredOn"),
        notes: readFormString(formData, "notes"),
      });

    if (!parsed.success) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: fieldErrorsFromZod(parsed.error),
      };
    }

    const entries = buildTransferEntries({
      fromAccountId: parsed.data.sourceAccountId,
      toAccountId: parsed.data.destinationAccountId,
      amount: parsed.data.amount,
    });

    const { data: transaction, error } = await supabase.rpc(
      "post_occurrence_payment",
      {
        p_occurrence_id: parsed.data.occurrenceId,
        p_transaction_type: "transfer",
        p_occurred_at: istCalendarDateToUtcIso(parsed.data.occurredOn),
        p_description: "Recurring transfer",
        p_entries: toEntriesPayload(entries),
        ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
      },
    );

    if (error || !transaction) {
      logRecurringError("record-payment:transfer", error?.code);
      return { status: "error", message: PAYMENT_FAILED_MESSAGE };
    }

    redirect(`/app/transactions/${transaction.id}?created=1`);
  }

  const parsed = recordPaymentSchema.safeParse({
    occurrenceId: readFormString(formData, "occurrenceId"),
    itemKind,
    accountId: readFormString(formData, "accountId"),
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
    categoryId: readFormString(formData, "categoryId"),
    payeeId: readFormString(formData, "payeeId"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  if (parsed.data.itemKind === "income") {
    const { data: uncategorizedIncomeAccountId } = await supabase
      .from("accounts")
      .select("id")
      .eq("system_code", "uncategorized_income")
      .eq("is_system", true)
      .maybeSingle();

    if (!uncategorizedIncomeAccountId) {
      return { status: "error", message: PAYMENT_FAILED_MESSAGE };
    }

    const entries = buildIncomeEntries({
      toAccountId: parsed.data.accountId,
      uncategorizedIncomeAccountId: uncategorizedIncomeAccountId.id,
      amount: parsed.data.amount,
    });

    const { data: transaction, error } = await supabase.rpc(
      "post_occurrence_payment",
      {
        p_occurrence_id: parsed.data.occurrenceId,
        p_transaction_type: "income",
        p_occurred_at: istCalendarDateToUtcIso(parsed.data.occurredOn),
        p_description: "Recurring income",
        p_entries: toEntriesPayload(entries),
        ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
        ...(parsed.data.categoryId
          ? { p_category_id: parsed.data.categoryId }
          : {}),
        ...(parsed.data.payeeId ? { p_payee_id: parsed.data.payeeId } : {}),
      },
    );

    if (error || !transaction) {
      logRecurringError("record-payment:income", error?.code);
      return { status: "error", message: PAYMENT_FAILED_MESSAGE };
    }

    redirect(`/app/transactions/${transaction.id}?created=1`);
  }

  // bill or subscription — the account's own type (never a client-supplied
  // flag) decides whether this posts as a credit_card_purchase, matching
  // attempt_post_occurrence's (supabase/migrations) server-side rule.
  const [{ data: uncategorizedExpenseAccountId }, { data: selectedAccount }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id")
        .eq("system_code", "uncategorized_expense")
        .eq("is_system", true)
        .maybeSingle(),
      supabase
        .from("accounts")
        .select("account_type")
        .eq("id", parsed.data.accountId)
        .maybeSingle(),
    ]);

  if (!uncategorizedExpenseAccountId || !selectedAccount) {
    return { status: "error", message: PAYMENT_FAILED_MESSAGE };
  }

  const isCreditCard = selectedAccount.account_type === "credit_card";

  const entries = isCreditCard
    ? buildCreditCardPurchaseEntries({
        creditCardAccountId: parsed.data.accountId,
        uncategorizedExpenseAccountId: uncategorizedExpenseAccountId.id,
        amount: parsed.data.amount,
      })
    : buildExpenseEntries({
        fromAccountId: parsed.data.accountId,
        uncategorizedExpenseAccountId: uncategorizedExpenseAccountId.id,
        amount: parsed.data.amount,
      });

  const { data: transaction, error } = await supabase.rpc(
    "post_occurrence_payment",
    {
      p_occurrence_id: parsed.data.occurrenceId,
      p_transaction_type: isCreditCard ? "credit_card_purchase" : "expense",
      p_occurred_at: istCalendarDateToUtcIso(parsed.data.occurredOn),
      p_description: "Recurring bill",
      p_entries: toEntriesPayload(entries),
      ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
      ...(parsed.data.categoryId
        ? { p_category_id: parsed.data.categoryId }
        : {}),
      ...(parsed.data.payeeId ? { p_payee_id: parsed.data.payeeId } : {}),
    },
  );

  if (error || !transaction) {
    logRecurringError("record-payment:expense", error?.code);
    return { status: "error", message: PAYMENT_FAILED_MESSAGE };
  }

  redirect(`/app/transactions/${transaction.id}?created=1`);
}

/** Links an already-posted, unlinked transaction to a due occurrence through public.link_existing_transaction_to_occurrence, instead of creating a new one. */
export async function linkExistingTransactionAction(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const occurrenceId = readFormString(formData, "occurrenceId");
  const transactionId = readFormString(formData, "transactionId");
  if (!occurrenceId || !transactionId) {
    return { status: "error", message: LINK_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc(
    "link_existing_transaction_to_occurrence",
    {
      p_occurrence_id: occurrenceId,
      p_transaction_id: transactionId,
    },
  );

  if (error) {
    logRecurringError("link", error.code);
    return { status: "error", message: LINK_FAILED_MESSAGE };
  }

  return { status: "success", message: "Transaction linked." };
}

/** Skips a due reminder_only occurrence through public.skip_occurrence — no transaction is created, and the recurring item's future cycles are unaffected. */
export async function skipOccurrenceAction(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const occurrenceId = readFormString(formData, "occurrenceId");
  if (!occurrenceId) {
    return { status: "error", message: SKIP_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("skip_occurrence", {
    p_occurrence_id: occurrenceId,
  });

  if (error) {
    logRecurringError("skip", error.code);
    return { status: "error", message: SKIP_FAILED_MESSAGE };
  }

  return { status: "success", message: "Occurrence skipped." };
}

/** Retries a failed auto_post occurrence through public.retry_failed_occurrence, which reuses the exact same posting core scheduled processing does. */
export async function retryFailedOccurrenceAction(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const occurrenceId = readFormString(formData, "occurrenceId");
  if (!occurrenceId) {
    return { status: "error", message: RETRY_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("retry_failed_occurrence", {
    p_occurrence_id: occurrenceId,
  });

  if (error || !data) {
    logRecurringError("retry", error?.code);
    return { status: "error", message: RETRY_FAILED_MESSAGE };
  }

  if (data.status === "failed") {
    return {
      status: "error",
      message:
        "The retry failed again. Please check the account and try later.",
    };
  }

  return { status: "success", message: "Occurrence posted." };
}

/** Runs the caller's own self-scoped catch-up (public.run_recurring_catchup_self) for when scheduled Cron processing was temporarily unavailable. */
export async function runRecurringCatchupAction(
  _prevState: RecurringActionState,
  _formData: FormData,
): Promise<RecurringActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .rpc("run_recurring_catchup_self")
    .maybeSingle();

  if (error || !data) {
    logRecurringError("catchup", error?.code);
    return {
      status: "error",
      message: "We couldn't refresh your recurring items. Please try again.",
    };
  }

  return {
    status: "success",
    message: `Checked ${data.processed_count} occurrence${data.processed_count === 1 ? "" : "s"}.`,
  };
}
