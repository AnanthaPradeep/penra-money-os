import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCapitalGainsReportForYear } from "@/lib/tax/capital-gains-data";
import { currentFinancialYear, type FinancialYear } from "@/lib/tax/financial-year";
import { isProfileWithinSupportedScope, type CompletenessStatus } from "@/lib/tax/mapping";
import {
  getTaxProfile,
  listTaxIncomeAdjustments,
  listTaxReconciliationItems,
  listTaxReportSnapshots,
  listTaxWithholdings,
} from "@/lib/tax/queries";
import { computeTaxReminders, type TaxReminder } from "@/lib/tax/reminders";
import { getRegimeComparisonForYear } from "@/lib/tax/regime-comparison-data";
import { getTaxRuleSet } from "@/lib/tax/rules/registry";
import type { Database } from "@/types/database.types";

export type EstimatedTaxStatus = "available" | "partial" | "unavailable";

export type TaxDashboardSummary = {
  financialYear: FinancialYear;
  ruleSetAvailable: boolean;
  profileExists: boolean;
  profileInScope: boolean;
  /** Completeness of the most recent report snapshot for this FY (finalized, else draft), or null if none has been generated yet. */
  completenessStatus: CompletenessStatus | null;
  unreviewedIncomeCount: number;
  disposalsNeedingReviewCount: number;
  reconciliationDifferencesCount: number;
  estimatedTaxStatus: EstimatedTaxStatus;
  estimatedTaxReasonCode: string | null;
  reminders: TaxReminder[];
};

/**
 * A single, isolated, self-contained summary for the home dashboard's "Tax
 * planning" section. Every value here is read-only and purely additive —
 * nothing computed in this module ever feeds back into net worth, income/
 * expense totals, debt balances, or the cash-flow forecast (see this
 * function's only caller, src/app/app/page.tsx, where the returned struct
 * is rendered in its own section and never merged into any other total).
 */
export async function getTaxDashboardSummary(
  supabase: SupabaseClient<Database>,
  today: string,
): Promise<TaxDashboardSummary> {
  const fy = currentFinancialYear();
  const ruleSetLookup = getTaxRuleSet(fy.id);

  const [
    profile,
    incomeAdjustments,
    withholdings,
    reconciliationItems,
    snapshots,
    latestUpdates,
  ] = await Promise.all([
    getTaxProfile(supabase),
    listTaxIncomeAdjustments(supabase, fy.id),
    listTaxWithholdings(supabase, fy.id),
    listTaxReconciliationItems(supabase, fy.id),
    listTaxReportSnapshots(supabase, fy.id),
    Promise.all(
      (
        ["tax_income_adjustments", "tax_deductions", "tax_withholdings", "tax_reconciliation_items"] as const
      ).map(async (table) => {
        const { data } = await supabase
          .from(table)
          .select("updated_at")
          .eq("financial_year_id", fy.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.updated_at ?? null;
      }),
    ),
  ]);

  const latestSourceDataUpdatedAt = latestUpdates
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1) ?? null;

  const unreviewedIncomeCount = incomeAdjustments.filter(
    (a) => a.status === "draft",
  ).length;
  const reconciliationDifferencesCount = reconciliationItems.filter(
    (r) =>
      r.status === "difference" ||
      r.status === "missing_in_penra" ||
      r.status === "missing_in_statement",
  ).length;

  let disposalsNeedingReviewCount = 0;
  if (ruleSetLookup.available) {
    const { report, unclassifiedHoldingCount, mixedCurrencyHoldingCount } =
      await getCapitalGainsReportForYear(supabase, ruleSetLookup.ruleSet, fy);
    disposalsNeedingReviewCount =
      report.unclassifiedOrUnsupportedCount +
      unclassifiedHoldingCount +
      mixedCurrencyHoldingCount;
  }

  let estimatedTaxStatus: EstimatedTaxStatus = "unavailable";
  let estimatedTaxReasonCode: string | null = ruleSetLookup.available
    ? null
    : "no_rule_set_for_financial_year";
  if (ruleSetLookup.available) {
    const comparison = await getRegimeComparisonForYear(supabase, ruleSetLookup.ruleSet, fy);
    if (!comparison.available) {
      estimatedTaxStatus = "unavailable";
      estimatedTaxReasonCode = comparison.reasonCode;
    } else if (
      comparison.result.old.status === "available" &&
      comparison.result.new.status === "available"
    ) {
      estimatedTaxStatus = "available";
      estimatedTaxReasonCode = null;
    } else if (
      comparison.result.old.status === "unavailable" &&
      comparison.result.new.status === "unavailable"
    ) {
      estimatedTaxStatus = "unavailable";
      estimatedTaxReasonCode = "surcharge_unsupported_above_threshold";
    } else {
      estimatedTaxStatus = "partial";
      estimatedTaxReasonCode = "surcharge_unsupported_above_threshold";
    }
  }

  const latestFinalized = snapshots.find((s) => s.status === "finalized");
  const latestDraft = snapshots.find(
    (s) => s.status === "draft" || s.status === "needs_review" || s.status === "ready",
  );
  const completenessStatus =
    (latestFinalized ?? latestDraft)?.completenessStatus ?? null;

  const reminders = computeTaxReminders({
    today,
    financialYear: fy,
    ruleSetAvailable: ruleSetLookup.available,
    profileExists: profile !== null,
    unreviewedIncomeCount,
    disposalsNeedingReviewCount,
    unreviewedWithholdingsCount: withholdings.filter(
      (w) => w.reconciliationStatus === "unreviewed",
    ).length,
    reconciliationDifferencesCount,
    snapshots,
    latestSourceDataUpdatedAt,
  });

  return {
    financialYear: fy,
    ruleSetAvailable: ruleSetLookup.available,
    profileExists: profile !== null,
    profileInScope: profile !== null && isProfileWithinSupportedScope(profile),
    completenessStatus,
    unreviewedIncomeCount,
    disposalsNeedingReviewCount,
    reconciliationDifferencesCount,
    estimatedTaxStatus,
    estimatedTaxReasonCode,
    reminders,
  };
}
