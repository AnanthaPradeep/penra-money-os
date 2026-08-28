import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCapitalGainsReportForYear,
} from "@/lib/tax/capital-gains-data";
import type { FinancialYear } from "@/lib/tax/financial-year";
import type {
  TaxDeduction,
  TaxIncomeAdjustment,
  TaxPayment,
  TaxProfile,
  TaxReconciliationItem,
  TaxWithholding,
} from "@/lib/tax/mapping";
import {
  getTaxProfile,
  listTaxDeductions,
  listTaxIncomeAdjustments,
  listTaxPayments,
  listTaxReconciliationItems,
  listTaxWithholdings,
} from "@/lib/tax/queries";
import {
  getRegimeComparisonForYear,
  type RegimeComparisonAvailability,
} from "@/lib/tax/regime-comparison-data";
import { getTaxRuleSet, type RuleSetLookupResult } from "@/lib/tax/rules/registry";
import type { Database } from "@/types/database.types";

export type TaxReviewPackCapitalGains = Awaited<
  ReturnType<typeof getCapitalGainsReportForYear>
>;

export type TaxReviewPackData = {
  financialYear: FinancialYear;
  ruleSetLookup: RuleSetLookupResult;
  profile: TaxProfile | null;
  incomeAdjustments: TaxIncomeAdjustment[];
  deductions: TaxDeduction[];
  withholdings: TaxWithholding[];
  payments: TaxPayment[];
  reconciliationItems: TaxReconciliationItem[];
  capitalGains: TaxReviewPackCapitalGains | null;
  regimeComparison: RegimeComparisonAvailability | null;
  generatedAt: string;
};

/**
 * Assembles the same live, already-established query/engine outputs the
 * individual workspace pages and CSV exports already show — this is a
 * pure read-only aggregation for the print-friendly review pack, not a
 * new source of truth, and never writes anything (no snapshot, no
 * ledger/report_snapshot row). Matches the CSV exports' own convention
 * (src/lib/tax/export/reports.ts) of always reflecting current live data
 * rather than requiring a saved snapshot first, timestamped at the moment
 * of generation.
 */
export async function getTaxReviewPackData(
  supabase: SupabaseClient<Database>,
  fy: FinancialYear,
): Promise<TaxReviewPackData> {
  const ruleSetLookup = getTaxRuleSet(fy.id);

  const [
    profile,
    incomeAdjustments,
    deductions,
    withholdings,
    payments,
    reconciliationItems,
  ] = await Promise.all([
    getTaxProfile(supabase),
    listTaxIncomeAdjustments(supabase, fy.id),
    listTaxDeductions(supabase, fy.id),
    listTaxWithholdings(supabase, fy.id),
    listTaxPayments(supabase, fy.id),
    listTaxReconciliationItems(supabase, fy.id),
  ]);

  let capitalGains: TaxReviewPackCapitalGains | null = null;
  let regimeComparison: RegimeComparisonAvailability | null = null;
  if (ruleSetLookup.available) {
    [capitalGains, regimeComparison] = await Promise.all([
      getCapitalGainsReportForYear(supabase, ruleSetLookup.ruleSet, fy),
      getRegimeComparisonForYear(supabase, ruleSetLookup.ruleSet, fy),
    ]);
  }

  return {
    financialYear: fy,
    ruleSetLookup,
    profile,
    incomeAdjustments,
    deductions,
    withholdings,
    payments,
    reconciliationItems,
    capitalGains,
    regimeComparison,
    generatedAt: new Date().toISOString(),
  };
}
