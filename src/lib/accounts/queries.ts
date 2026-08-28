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

/**
 * Account types counted as "eligible liquid balance" for wallets/safe-to-
 * spend/forecast (see public.eligible_liquid_balance in
 * supabase/migrations/20260826112813_phase12_purpose_wallets.sql) —
 * mirrored here as a literal rather than round-tripped through SQL since
 * it is only ever used to label a single already-loaded account, and must
 * stay byte-for-byte in sync with that function's own account_type list.
 */
const FORECAST_ELIGIBLE_ACCOUNT_TYPES = [
  "bank_savings",
  "bank_current",
  "cash",
  "wallet",
  "other_asset",
] as const;

export type AccountIntegrationSummary = {
  /** Whether this account's balance counts toward eligible-liquid-balance / safe-to-spend / the cash-flow forecast. */
  forecastEligible: boolean;
  /** This account's own posted expense / credit-card-purchase transactions that CAN be tagged to a purpose wallet. */
  walletEligibleTransactionCount: number;
  /** Of those, the ones already tagged — grouped by wallet. */
  backedAllocations: { walletId: string; walletName: string; transactionCount: number; totalAmount: Money }[];
  linkedGoals: { goalId: string; name: string }[];
  linkedDebt: { debtId: string; name: string } | null;
};

/**
 * Read-only cross-module summary for the account-detail page — every
 * value here is purely informational, never mutates anything, and mirrors
 * data already owned by the wallets/goals/debts modules rather than
 * duplicating their write paths.
 */
export async function getAccountIntegrationSummary(
  supabase: SupabaseClient<Database>,
  accountId: string,
  account: Pick<Account, "accountType" | "isArchived">,
): Promise<AccountIntegrationSummary> {
  const [entriesResult, goalLinksResult, debtResult] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("transaction_id, ledger_transactions(transaction_type, status)")
      .eq("account_id", accountId),
    supabase
      .from("goal_account_links")
      .select("goal_id, financial_goals(name)")
      .eq("account_id", accountId),
    supabase
      .from("debts")
      .select("id, name")
      .eq("liability_account_id", accountId)
      .maybeSingle(),
  ]);

  const eligibleTransactionIds = new Set(
    (entriesResult.data ?? [])
      .filter((r) => {
        const txn = r.ledger_transactions as
          | { transaction_type: string; status: string }
          | null;
        return (
          txn?.status === "posted" &&
          (txn.transaction_type === "expense" ||
            txn.transaction_type === "credit_card_purchase")
        );
      })
      .map((r) => r.transaction_id),
  );
  const transactionIds = Array.from(eligibleTransactionIds);
  const walletEligibleTransactionCount = transactionIds.length;

  let backedAllocations: AccountIntegrationSummary["backedAllocations"] = [];
  if (transactionIds.length > 0) {
    const { data: allocations } = await supabase
      .from("transaction_purpose_allocations")
      .select("transaction_id, amount, purpose_wallets(id, name)")
      .in("transaction_id", transactionIds);

    const byWallet = new Map<
      string,
      { walletName: string; transactionCount: number; totalAmount: Decimal }
    >();
    for (const row of allocations ?? []) {
      const wallet = row.purpose_wallets as { id: string; name: string } | null;
      if (!wallet) {
        continue;
      }
      const existing = byWallet.get(wallet.id);
      const amount = new Decimal(row.amount);
      if (existing) {
        existing.transactionCount += 1;
        existing.totalAmount = existing.totalAmount.plus(amount);
      } else {
        byWallet.set(wallet.id, {
          walletName: wallet.name,
          transactionCount: 1,
          totalAmount: amount,
        });
      }
    }
    backedAllocations = Array.from(byWallet.entries()).map(([walletId, v]) => ({
      walletId,
      walletName: v.walletName,
      transactionCount: v.transactionCount,
      totalAmount: v.totalAmount,
    }));
  }

  const linkedGoals = (goalLinksResult.data ?? [])
    .map((row) => {
      const goal = row.financial_goals as { name: string } | null;
      return goal ? { goalId: row.goal_id, name: goal.name } : null;
    })
    .filter((g): g is { goalId: string; name: string } => g !== null);

  return {
    forecastEligible:
      !account.isArchived &&
      (FORECAST_ELIGIBLE_ACCOUNT_TYPES as readonly string[]).includes(
        account.accountType,
      ),
    walletEligibleTransactionCount,
    backedAllocations,
    linkedGoals,
    linkedDebt: debtResult.data
      ? { debtId: debtResult.data.id, name: debtResult.data.name }
      : null,
  };
}
