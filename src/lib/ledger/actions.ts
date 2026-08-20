"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";

import { getSystemAccountId } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { istCalendarDateToUtcIso } from "@/lib/dates/timezone";
import {
  buildCreditCardPaymentEntries,
  buildCreditCardPurchaseEntries,
  buildExpenseEntries,
  buildIncomeEntries,
  buildTransferEntries,
  toEntriesPayload,
  type LedgerEntryInput,
} from "@/lib/ledger/entry-builder";
import type { TransactionActionState } from "@/lib/ledger/action-state";
import {
  creditCardPaymentSchema,
  creditCardPurchaseSchema,
  editTransactionSchema,
  expenseTransactionSchema,
  incomeTransactionSchema,
  transferTransactionSchema,
} from "@/lib/ledger/schema";
import type { ManualTransactionType } from "@/lib/ledger/transaction-types";
import { toDbAmountString } from "@/lib/money/parse";
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
function logTransactionError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[ledger:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE =
  "You need to sign in again to record transactions.";
const CREATE_FAILED_MESSAGE =
  "We couldn't record that transaction. Please try again.";
const SYSTEM_ACCOUNT_MISSING_MESSAGE =
  "Something went wrong setting up your account. Please try again.";

/**
 * Posts a manual transaction through public.create_manual_transaction (see
 * supabase/migrations), which stores the header and every entry
 * atomically and relies on database triggers to enforce ownership,
 * currency consistency, and the sum-to-zero invariant. entries here are
 * already built (signed, two-account) by the caller — see
 * src/lib/ledger/entry-builder.ts for why the SQL function itself stays
 * agnostic to transaction-type-specific account rules.
 */
type PostManualTransactionParams = {
  transactionType: ManualTransactionType;
  occurredOn: string;
  description: string;
  notes: string | undefined;
  categoryId: string | undefined;
  payeeId: string | undefined;
  idempotencyKey: string;
  entries: LedgerEntryInput[];
};

async function postManualTransaction({
  transactionType,
  occurredOn,
  description,
  notes,
  categoryId,
  payeeId,
  idempotencyKey,
  entries,
}: PostManualTransactionParams): Promise<TransactionActionState> {
  const supabase = await createSupabaseServerClient();

  const { data: transaction, error } = await supabase.rpc(
    "create_manual_transaction",
    {
      p_transaction_type: transactionType,
      p_occurred_at: istCalendarDateToUtcIso(occurredOn),
      p_description: description,
      p_entries: toEntriesPayload(entries),
      p_idempotency_key: idempotencyKey,
      ...(notes ? { p_notes: notes } : {}),
      ...(categoryId ? { p_category_id: categoryId } : {}),
      ...(payeeId ? { p_payee_id: payeeId } : {}),
    },
  );

  if (error || !transaction) {
    logTransactionError(`create:${transactionType}`, error?.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  redirect(`/app/transactions/${transaction.id}?created=1`);
}

export async function createIncomeTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = incomeTransactionSchema.safeParse({
    toAccountId: readFormString(formData, "toAccountId"),
    categoryId: readFormString(formData, "categoryId"),
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
    description: readFormString(formData, "description"),
    payeeId: readFormString(formData, "payeeId"),
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
  const uncategorizedIncomeAccountId = await getSystemAccountId(
    supabase,
    "uncategorized_income",
  );
  if (!uncategorizedIncomeAccountId) {
    logTransactionError("create:income", "missing_system_account");
    return { status: "error", message: SYSTEM_ACCOUNT_MISSING_MESSAGE };
  }

  const entries = buildIncomeEntries({
    toAccountId: parsed.data.toAccountId,
    uncategorizedIncomeAccountId,
    amount: parsed.data.amount,
  });

  return postManualTransaction({
    transactionType: "income",
    occurredOn: parsed.data.occurredOn,
    description: parsed.data.description,
    notes: parsed.data.notes,
    categoryId: parsed.data.categoryId,
    payeeId: parsed.data.payeeId,
    idempotencyKey: parsed.data.idempotencyKey,
    entries,
  });
}

export async function createExpenseTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = expenseTransactionSchema.safeParse({
    fromAccountId: readFormString(formData, "fromAccountId"),
    categoryId: readFormString(formData, "categoryId"),
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
    description: readFormString(formData, "description"),
    payeeId: readFormString(formData, "payeeId"),
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
  const uncategorizedExpenseAccountId = await getSystemAccountId(
    supabase,
    "uncategorized_expense",
  );
  if (!uncategorizedExpenseAccountId) {
    logTransactionError("create:expense", "missing_system_account");
    return { status: "error", message: SYSTEM_ACCOUNT_MISSING_MESSAGE };
  }

  const entries = buildExpenseEntries({
    fromAccountId: parsed.data.fromAccountId,
    uncategorizedExpenseAccountId,
    amount: parsed.data.amount,
  });

  return postManualTransaction({
    transactionType: "expense",
    occurredOn: parsed.data.occurredOn,
    description: parsed.data.description,
    notes: parsed.data.notes,
    categoryId: parsed.data.categoryId,
    payeeId: parsed.data.payeeId,
    idempotencyKey: parsed.data.idempotencyKey,
    entries,
  });
}

export async function createTransferTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = transferTransactionSchema.safeParse({
    fromAccountId: readFormString(formData, "fromAccountId"),
    toAccountId: readFormString(formData, "toAccountId"),
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
    description: readFormString(formData, "description"),
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

  const entries = buildTransferEntries({
    fromAccountId: parsed.data.fromAccountId,
    toAccountId: parsed.data.toAccountId,
    amount: parsed.data.amount,
  });

  return postManualTransaction({
    transactionType: "transfer",
    occurredOn: parsed.data.occurredOn,
    description: parsed.data.description,
    notes: parsed.data.notes,
    categoryId: undefined,
    payeeId: undefined,
    idempotencyKey: parsed.data.idempotencyKey,
    entries,
  });
}

export async function createCreditCardPurchaseAction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = creditCardPurchaseSchema.safeParse({
    creditCardAccountId: readFormString(formData, "creditCardAccountId"),
    categoryId: readFormString(formData, "categoryId"),
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
    description: readFormString(formData, "description"),
    payeeId: readFormString(formData, "payeeId"),
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
  const uncategorizedExpenseAccountId = await getSystemAccountId(
    supabase,
    "uncategorized_expense",
  );
  if (!uncategorizedExpenseAccountId) {
    logTransactionError(
      "create:credit_card_purchase",
      "missing_system_account",
    );
    return { status: "error", message: SYSTEM_ACCOUNT_MISSING_MESSAGE };
  }

  const entries = buildCreditCardPurchaseEntries({
    creditCardAccountId: parsed.data.creditCardAccountId,
    uncategorizedExpenseAccountId,
    amount: parsed.data.amount,
  });

  return postManualTransaction({
    transactionType: "credit_card_purchase",
    occurredOn: parsed.data.occurredOn,
    description: parsed.data.description,
    notes: parsed.data.notes,
    categoryId: parsed.data.categoryId,
    payeeId: parsed.data.payeeId,
    idempotencyKey: parsed.data.idempotencyKey,
    entries,
  });
}

export async function createCreditCardPaymentAction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = creditCardPaymentSchema.safeParse({
    creditCardAccountId: readFormString(formData, "creditCardAccountId"),
    fromAccountId: readFormString(formData, "fromAccountId"),
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
    description: readFormString(formData, "description"),
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

  const entries = buildCreditCardPaymentEntries({
    creditCardAccountId: parsed.data.creditCardAccountId,
    fromAccountId: parsed.data.fromAccountId,
    amount: parsed.data.amount,
  });

  return postManualTransaction({
    transactionType: "credit_card_payment",
    occurredOn: parsed.data.occurredOn,
    description: parsed.data.description,
    notes: parsed.data.notes,
    categoryId: undefined,
    payeeId: undefined,
    idempotencyKey: parsed.data.idempotencyKey,
    entries,
  });
}

const REVERSAL_FAILED_MESSAGE =
  "We couldn't reverse that transaction. Please try again.";

/**
 * Reverses a posted transaction through public.reverse_transaction (see
 * supabase/migrations), which race-safely marks the original as reversed
 * and posts a new linked transaction with negated entries. transactionId
 * comes from the page's own route param / server-verified data, never
 * trusted as freeform client input beyond being a plain form field here.
 */
export async function reverseTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const transactionId = readFormString(formData, "transactionId");
  if (!transactionId) {
    return { status: "error", message: REVERSAL_FAILED_MESSAGE };
  }

  const reason = readFormString(formData, "reason");

  const supabase = await createSupabaseServerClient();
  const { data: reversal, error } = await supabase.rpc("reverse_transaction", {
    p_transaction_id: transactionId,
    ...(reason ? { p_reason: reason } : {}),
  });

  if (error || !reversal) {
    logTransactionError("reverse", error?.code);
    return { status: "error", message: REVERSAL_FAILED_MESSAGE };
  }

  redirect(`/app/transactions/${reversal.id}?reversed=1`);
}

const EDIT_FAILED_MESSAGE =
  "We couldn't save that correction. Please try again.";

/**
 * Corrects a posted manual transaction through public.edit_manual_
 * transaction (see supabase/migrations), which atomically reverses the
 * original and posts a replacement with the new values, preserving full
 * audit history. Keeps the original's accounts and transaction type fixed
 * — only amount/date/description/category/payee/notes change here; the
 * accounts a transaction touches are read back from the original's own
 * entries rather than trusted from client input, and each new entry
 * reuses the same account with the same debit/credit sign as before,
 * scaled to the corrected amount.
 */
export async function editTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const transactionId = readFormString(formData, "transactionId");
  if (!transactionId) {
    return { status: "error", message: EDIT_FAILED_MESSAGE };
  }

  const parsed = editTransactionSchema.safeParse({
    amount: readFormString(formData, "amount"),
    occurredOn: readFormString(formData, "occurredOn"),
    description: readFormString(formData, "description"),
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

  const supabase = await createSupabaseServerClient();

  const { data: entryRows, error: entriesError } = await supabase
    .from("ledger_entries")
    .select("account_id, amount")
    .eq("transaction_id", transactionId);

  if (entriesError || !entryRows || entryRows.length < 2) {
    logTransactionError("edit:load-entries", entriesError?.code);
    return { status: "error", message: EDIT_FAILED_MESSAGE };
  }

  const entries = entryRows.map((row) => ({
    account_id: row.account_id,
    amount: toDbAmountString(
      row.amount >= 0 ? parsed.data.amount : parsed.data.amount.negated(),
    ),
    currency: "INR",
  }));

  const { data: replacement, error } = await supabase.rpc(
    "edit_manual_transaction",
    {
      p_transaction_id: transactionId,
      p_occurred_at: istCalendarDateToUtcIso(parsed.data.occurredOn),
      p_description: parsed.data.description,
      p_entries: entries,
      ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
      ...(parsed.data.categoryId
        ? { p_category_id: parsed.data.categoryId }
        : {}),
      ...(parsed.data.payeeId ? { p_payee_id: parsed.data.payeeId } : {}),
    },
  );

  if (error || !replacement) {
    logTransactionError("edit", error?.code);
    return { status: "error", message: EDIT_FAILED_MESSAGE };
  }

  redirect(`/app/transactions/${replacement.id}?edited=1`);
}
