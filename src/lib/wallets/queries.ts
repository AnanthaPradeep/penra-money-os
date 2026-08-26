import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { Decimal } from "@/lib/money/decimal";
import type { Database } from "@/types/database.types";
import {
  mapIncomeAllocationApplicationRow,
  mapIncomeAllocationPlanLineRow,
  mapIncomeAllocationPlanRow,
  mapPurposeWalletMovementRow,
  mapPurposeWalletRow,
  mapTransactionPurposeAllocationRow,
  type IncomeAllocationApplication,
  type IncomeAllocationPlan,
  type IncomeAllocationPlanLine,
  type PurposeWallet,
  type PurposeWalletMovement,
  type PurposeWalletSummary,
  type SafeToSpendSummary,
  type TransactionPurposeAllocation,
} from "@/lib/wallets/mapping";

/** Lists the caller's own purpose wallets, active first, then by priority — see purpose_wallets_user_status_idx. */
export async function listPurposeWallets(
  supabase: SupabaseClient<Database>,
  options: { includeArchived?: boolean } = {},
): Promise<PurposeWallet[]> {
  let query = supabase
    .from("purpose_wallets")
    .select("*")
    .order("priority", { ascending: false })
    .order("name", { ascending: true });

  if (!options.includeArchived) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map(mapPurposeWalletRow);
}

/** Reads a single purpose wallet owned by the caller. */
export async function getPurposeWallet(
  supabase: SupabaseClient<Database>,
  walletId: string,
): Promise<PurposeWallet | null> {
  const { data, error } = await supabase
    .from("purpose_wallets")
    .select("*")
    .eq("id", walletId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapPurposeWalletRow(data);
}

/** Lists a wallet's movement history, newest first — the immutable ledger a wallet's balance is always derived from. */
export async function listPurposeWalletMovements(
  supabase: SupabaseClient<Database>,
  walletId: string,
  limit = 50,
): Promise<PurposeWalletMovement[]> {
  const { data, error } = await supabase
    .from("purpose_wallet_movements")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }
  return data.map(mapPurposeWalletMovementRow);
}

/** Every wallet's derived allocated/spent/overspent figures, via public.get_purpose_wallet_summary — never a cached total. */
export async function getPurposeWalletSummaries(
  supabase: SupabaseClient<Database>,
): Promise<PurposeWalletSummary[]> {
  const { data, error } = await supabase.rpc("get_purpose_wallet_summary");
  if (error || !data) {
    return [];
  }
  return data.map((row) => ({
    walletId: row.wallet_id,
    name: row.name,
    currency: row.currency,
    fundingMode:
      row.funding_mode === "planning_only" ? "planning_only" : "earmarked",
    status: row.status === "archived" ? "archived" : "active",
    targetAmount:
      row.target_amount === null ? null : new Decimal(row.target_amount),
    allocatedBalance: new Decimal(row.allocated_balance ?? 0),
    spentAmount: new Decimal(row.spent_amount ?? 0),
    overspentAmount: new Decimal(row.overspent_amount ?? 0),
  }));
}

/** An explainable safe-to-spend estimate for one currency, via public.get_safe_to_spend_summary. */
export async function getSafeToSpendSummary(
  supabase: SupabaseClient<Database>,
  currency = "INR",
): Promise<SafeToSpendSummary | null> {
  const { data, error } = await supabase
    .rpc("get_safe_to_spend_summary", { p_currency: currency })
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    currency: data.currency ?? currency,
    eligibleLiquidBalance: new Decimal(data.eligible_liquid_balance ?? 0),
    earmarkedAllocation: new Decimal(data.earmarked_allocation ?? 0),
    nearTermCommitments: new Decimal(data.near_term_commitments ?? 0),
    safeToSpend: new Decimal(data.safe_to_spend ?? 0),
    asOf: data.as_of ?? new Date().toISOString(),
  };
}

/** Reads which wallet (if any) a posted expense/credit-card-purchase transaction has been assigned to. */
export async function getTransactionPurposeAllocation(
  supabase: SupabaseClient<Database>,
  transactionId: string,
): Promise<TransactionPurposeAllocation | null> {
  const { data, error } = await supabase
    .from("transaction_purpose_allocations")
    .select("*")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapTransactionPurposeAllocationRow(data);
}

/** Lists the caller's own income allocation plans, active first. */
export async function listIncomeAllocationPlans(
  supabase: SupabaseClient<Database>,
  options: { includeArchived?: boolean } = {},
): Promise<IncomeAllocationPlan[]> {
  let query = supabase
    .from("income_allocation_plans")
    .select("*")
    .order("effective_date", { ascending: false });

  if (!options.includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map(mapIncomeAllocationPlanRow);
}

export type IncomeAllocationPlanWithLines = {
  plan: IncomeAllocationPlan;
  lines: IncomeAllocationPlanLine[];
};

/** Reads one plan together with its ordered allocation lines. */
export async function getIncomeAllocationPlanWithLines(
  supabase: SupabaseClient<Database>,
  planId: string,
): Promise<IncomeAllocationPlanWithLines | null> {
  const [planResult, linesResult] = await Promise.all([
    supabase
      .from("income_allocation_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle(),
    supabase
      .from("income_allocation_plan_lines")
      .select("*")
      .eq("plan_id", planId)
      .order("line_order", { ascending: true }),
  ]);

  if (planResult.error || !planResult.data) {
    return null;
  }

  return {
    plan: mapIncomeAllocationPlanRow(planResult.data),
    lines: (linesResult.data ?? []).map(mapIncomeAllocationPlanLineRow),
  };
}

/** Lists every application of any of the caller's plans to an income transaction, newest first. */
export async function listIncomeAllocationApplications(
  supabase: SupabaseClient<Database>,
  planId?: string,
): Promise<IncomeAllocationApplication[]> {
  let query = supabase
    .from("income_allocation_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (planId) {
    query = query.eq("plan_id", planId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map(mapIncomeAllocationApplicationRow);
}
