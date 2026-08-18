import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SystemAccountType } from "@/lib/accounts/classes";
import { mapAccountRow, type Account } from "@/lib/accounts/mapping";
import { Decimal, type Money } from "@/lib/money/decimal";
import type { Database } from "@/types/database.types";

/**
 * Looks up one of the caller's own hidden system accounts by its
 * system_code (see public.accounts / provision_system_accounts in
 * supabase/migrations). Relies on Row Level Security to scope the result
 * to the authenticated caller — there is no explicit user_id filter here
 * because the Supabase client passed in is always request-scoped.
 */
export async function getSystemAccountId(
  supabase: SupabaseClient<Database>,
  systemCode: SystemAccountType,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("system_code", systemCode)
    .eq("is_system", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id;
}

export type AccountWithBalance = Account & { displayBalance: Money };

/**
 * Lists the caller's own user-facing (non-system) accounts together with
 * their current balance, read from public.account_balances (see
 * supabase/migrations) — a security_invoker view, so it is subject to the
 * same RLS as querying the underlying tables directly. Two queries plus an
 * in-memory join, rather than a single embedded query, because the view is
 * not a foreign-key relationship PostgREST can embed automatically.
 */
export async function listAccountsWithBalances(
  supabase: SupabaseClient<Database>,
): Promise<AccountWithBalance[]> {
  const [accountsResult, balancesResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("is_system", false)
      .order("name", { ascending: true }),
    supabase.from("account_balances").select("account_id, display_balance"),
  ]);

  if (accountsResult.error || !accountsResult.data) {
    return [];
  }

  const balanceByAccountId = new Map<string, number>();
  for (const row of balancesResult.data ?? []) {
    if (row.account_id !== null && row.display_balance !== null) {
      balanceByAccountId.set(row.account_id, row.display_balance);
    }
  }

  return accountsResult.data.map((row) => ({
    ...mapAccountRow(row),
    displayBalance: new Decimal(balanceByAccountId.get(row.id) ?? 0),
  }));
}

/** Reads a single account owned by the caller, together with its current balance. */
export async function getAccountWithBalance(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<AccountWithBalance | null> {
  const [accountResult, balanceResult] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", accountId).maybeSingle(),
    supabase
      .from("account_balances")
      .select("display_balance")
      .eq("account_id", accountId)
      .maybeSingle(),
  ]);

  if (accountResult.error || !accountResult.data) {
    return null;
  }

  return {
    ...mapAccountRow(accountResult.data),
    displayBalance: new Decimal(balanceResult.data?.display_balance ?? 0),
  };
}
