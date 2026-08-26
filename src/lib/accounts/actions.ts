"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { AccountActionState } from "@/lib/accounts/action-state";
import { accountFormSchema } from "@/lib/accounts/schema";
import {
  istCalendarDateToUtcIso,
  nowAsIstCalendarDate,
} from "@/lib/dates/timezone";
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
function logAccountError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[accounts:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage accounts.";
const CREATE_FAILED_MESSAGE =
  "We couldn't create that account. Please try again.";

/**
 * Creates an account through public.create_account_with_opening_balance
 * (see supabase/migrations) rather than a plain insert — that function
 * atomically posts the balanced opening-balance transaction when one is
 * given, and derives account_class from account_type server-side, so this
 * action never sends a class value the browser could have tampered with.
 */
export async function createAccountAction(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = accountFormSchema.safeParse({
    name: readFormString(formData, "name"),
    accountType: readFormString(formData, "accountType"),
    institutionId: readFormString(formData, "institutionId"),
    currency: readFormString(formData, "currency") || "INR",
    lastFour: readFormString(formData, "lastFour"),
    creditLimit: readFormString(formData, "creditLimit"),
    openedOn: readFormString(formData, "openedOn"),
    notes: readFormString(formData, "notes"),
    openingBalance: readFormString(formData, "openingBalance"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const hasOpeningBalance = parsed.data.openingBalance !== undefined;
  const openingBalanceAt = hasOpeningBalance
    ? istCalendarDateToUtcIso(parsed.data.openedOn ?? nowAsIstCalendarDate())
    : undefined;

  const supabase = await createSupabaseServerClient();

  // Ownership comes from the caller's session inside the database function
  // (auth.uid()) — no user_id is ever passed from this action. Every
  // optional field is spread in only when present, so an omitted value is
  // dropped from the RPC payload entirely (both for the generated Args
  // type, under exactOptionalPropertyTypes, and at runtime), which
  // PostgREST/Postgres then resolves to the function's own `default null`.
  //
  // p_credit_limit/p_opening_balance are declared as `numeric` in SQL (see
  // supabase/migrations) — .toNumber() here is a one-time boundary
  // p_credit_limit/p_opening_balance are declared as `text` in SQL (see
  // supabase/migrations) — deliberately, so the exact decimal string this
  // app already produces round-trips through PostgREST without ever
  // passing through a JSON `number`, matching this app's "no JS
  // floating-point math on money" rule (see src/lib/money/decimal.ts) all
  // the way to the database boundary.
  const { data: account, error } = await supabase.rpc(
    "create_account_with_opening_balance",
    {
      p_name: parsed.data.name,
      p_account_type: parsed.data.accountType,
      ...(parsed.data.institutionId
        ? { p_institution_id: parsed.data.institutionId }
        : {}),
      p_currency: parsed.data.currency,
      ...(parsed.data.lastFour ? { p_last_four: parsed.data.lastFour } : {}),
      ...(parsed.data.creditLimit
        ? { p_credit_limit: toDbAmountString(parsed.data.creditLimit) }
        : {}),
      ...(parsed.data.openedOn ? { p_opened_on: parsed.data.openedOn } : {}),
      ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
      ...(parsed.data.openingBalance
        ? { p_opening_balance: toDbAmountString(parsed.data.openingBalance) }
        : {}),
      ...(openingBalanceAt ? { p_opening_balance_at: openingBalanceAt } : {}),
    },
  );

  if (error || !account) {
    logAccountError("create", error?.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  redirect(`/app/accounts/${account.id}?created=1`);
}

const ARCHIVE_FAILED_MESSAGE =
  "We couldn't archive that account. Please try again.";

/**
 * Archives an account via a plain, RLS-scoped update — no new atomic SQL
 * function is needed since `is_archived` is already part of the
 * column-level UPDATE grant on public.accounts (see
 * supabase/migrations/20260817153217_create_ledger_foundation.sql), and
 * archiving never touches ledger_transactions/ledger_entries — every
 * posted entry stays exactly as it was, immutable and visible.
 */
export async function archiveAccountAction(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const accountId = readFormString(formData, "accountId");
  if (!accountId) {
    return { status: "error", message: ARCHIVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: true })
    .eq("id", accountId)
    .eq("is_system", false);

  if (error) {
    logAccountError("archive", error.code);
    return { status: "error", message: ARCHIVE_FAILED_MESSAGE };
  }

  redirect(`/app/accounts/${accountId}?archived=1`);
}
