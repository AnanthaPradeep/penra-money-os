import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { Decimal } from "@/lib/money/decimal";
import {
  mapAllocationByAssetRow,
  mapAllocationByKindRow,
  mapFixedIncomeDetailsRow,
  mapHoldingSummaryRow,
  mapInvestmentActivityRow,
  mapInvestmentAssetRow,
  mapInvestmentHoldingRow,
  mapInvestmentValuationRow,
  mapMaturityEventRow,
  mapNetWorthSummaryRow,
  mapPortfolioSummaryRow,
  mapPpfFinancialYearSummaryRow,
  type AllocationByAsset,
  type AllocationByKind,
  type FixedIncomeDetails,
  type HoldingSummary,
  type InvestmentActivity,
  type InvestmentAsset,
  type InvestmentHolding,
  type InvestmentValuation,
  type MaturityEvent,
  type NetWorthSummary,
  type PortfolioSummary,
  type PpfFinancialYearSummary,
} from "@/lib/investments/mapping";
import type { Database } from "@/types/database.types";

export async function listInvestmentAssets(
  supabase: SupabaseClient<Database>,
): Promise<InvestmentAsset[]> {
  const { data, error } = await supabase
    .from("investment_assets")
    .select("*")
    .order("display_name", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapInvestmentAssetRow);
}

export async function getInvestmentHoldingById(
  supabase: SupabaseClient<Database>,
  holdingId: string,
): Promise<InvestmentHolding | null> {
  const { data, error } = await supabase
    .from("investment_holdings")
    .select("*")
    .eq("id", holdingId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapInvestmentHoldingRow(data);
}

export async function getInvestmentAssetById(
  supabase: SupabaseClient<Database>,
  assetId: string,
): Promise<InvestmentAsset | null> {
  const { data, error } = await supabase
    .from("investment_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapInvestmentAssetRow(data);
}

export async function getFixedIncomeDetailsForHolding(
  supabase: SupabaseClient<Database>,
  holdingId: string,
): Promise<FixedIncomeDetails | null> {
  const { data, error } = await supabase
    .from("fixed_income_details")
    .select("*")
    .eq("holding_id", holdingId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapFixedIncomeDetailsRow(data);
}

export async function listActivitiesForHolding(
  supabase: SupabaseClient<Database>,
  holdingId: string,
): Promise<InvestmentActivity[]> {
  const { data, error } = await supabase
    .from("investment_activities")
    .select("*")
    .eq("holding_id", holdingId)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapInvestmentActivityRow);
}

export async function listValuationsForHolding(
  supabase: SupabaseClient<Database>,
  holdingId: string,
): Promise<InvestmentValuation[]> {
  const { data, error } = await supabase
    .from("investment_valuations")
    .select("*")
    .eq("holding_id", holdingId)
    .order("valued_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapInvestmentValuationRow);
}

/** Per-holding position/valuation/gain summary for every one of the caller's holdings — see public.investment_holding_summary. */
export async function getHoldingSummaries(
  supabase: SupabaseClient<Database>,
): Promise<HoldingSummary[]> {
  const { data, error } = await supabase.rpc("investment_holding_summary");

  if (error || !data) {
    return [];
  }
  return data.map(mapHoldingSummaryRow);
}

export async function getHoldingSummaryById(
  supabase: SupabaseClient<Database>,
  holdingId: string,
): Promise<HoldingSummary | null> {
  const summaries = await getHoldingSummaries(supabase);
  return summaries.find((s) => s.holdingId === holdingId) ?? null;
}

const ZERO_PORTFOLIO_SUMMARY: PortfolioSummary = {
  currency: "INR",
  totalInvestedCost: new Decimal(0),
  totalCurrentValue: new Decimal(0),
  totalUnrealizedGain: new Decimal(0),
  totalRealizedGain: new Decimal(0),
  totalIncomeReceived: new Decimal(0),
  activeHoldingsCount: 0,
  missingValuationCount: 0,
};

/** Whole-portfolio totals, one row per currency — see public.portfolio_summary. Never combined across currencies. */
export async function getPortfolioSummaries(
  supabase: SupabaseClient<Database>,
): Promise<PortfolioSummary[]> {
  const { data, error } = await supabase.rpc("portfolio_summary");

  if (error || !data) {
    return [];
  }
  return data.map(mapPortfolioSummaryRow);
}

/** Convenience accessor for the primary (INR) portfolio summary — falls back to an all-zero summary when the caller has no holdings yet. */
export async function getPrimaryPortfolioSummary(
  supabase: SupabaseClient<Database>,
): Promise<PortfolioSummary> {
  const summaries = await getPortfolioSummaries(supabase);
  return summaries.find((s) => s.currency === "INR") ?? ZERO_PORTFOLIO_SUMMARY;
}

/** Net worth, one row per currency — see public.net_worth_summary. */
export async function getNetWorthSummaries(
  supabase: SupabaseClient<Database>,
): Promise<NetWorthSummary[]> {
  const { data, error } = await supabase.rpc("net_worth_summary");

  if (error || !data) {
    return [];
  }
  return data.map(mapNetWorthSummaryRow);
}

export async function getAllocationByKind(
  supabase: SupabaseClient<Database>,
): Promise<AllocationByKind[]> {
  const { data, error } = await supabase.rpc("asset_allocation_by_kind");

  if (error || !data) {
    return [];
  }
  return data.map(mapAllocationByKindRow);
}

export async function getAllocationByAsset(
  supabase: SupabaseClient<Database>,
): Promise<AllocationByAsset[]> {
  const { data, error } = await supabase.rpc("asset_allocation_by_asset");

  if (error || !data) {
    return [];
  }
  return data.map(mapAllocationByAssetRow);
}

export async function getUpcomingMaturityEvents(
  supabase: SupabaseClient<Database>,
  withinDays = 90,
): Promise<MaturityEvent[]> {
  const { data, error } = await supabase.rpc("upcoming_maturity_events", {
    p_within_days: withinDays,
  });

  if (error || !data) {
    return [];
  }
  const events: MaturityEvent[] = [];
  for (const row of data) {
    const mapped = mapMaturityEventRow(row);
    if (mapped) {
      events.push(mapped);
    }
  }
  return events;
}

export async function getPpfFinancialYearSummary(
  supabase: SupabaseClient<Database>,
  financialYearStartDate: string,
): Promise<PpfFinancialYearSummary[]> {
  const { data, error } = await supabase.rpc("ppf_financial_year_summary", {
    p_financial_year_start_date: financialYearStartDate,
  });

  if (error || !data) {
    return [];
  }
  return data.map(mapPpfFinancialYearSummaryRow);
}
