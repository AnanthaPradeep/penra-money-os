import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { Decimal } from "@/lib/money/decimal";
import { getCapitalGainsReportForYear } from "@/lib/tax/capital-gains-data";
import {
  compareRegimes,
  type RegimeComparisonResult,
} from "@/lib/tax/engine/regime-comparison";
import type { FinancialYear } from "@/lib/tax/financial-year";
import { isProfileWithinSupportedScope } from "@/lib/tax/mapping";
import {
  listTaxDeductions,
  listTaxIncomeAdjustments,
  listTaxPayments,
  listTaxWithholdings,
  getTaxProfile,
} from "@/lib/tax/queries";
import type { TaxRuleSet } from "@/lib/tax/rules/types";
import type { Database } from "@/types/database.types";

export type RegimeComparisonAvailability =
  | {
      available: true;
      result: RegimeComparisonResult;
      hasSalaryOrPensionIncome: boolean;
    }
  | { available: false; reasonCode: "no_profile" | "unsupported_profile" };

/** Assembles real income/deduction/withholding/capital-gains data for one financial year and runs the pure old/new regime comparison engine over it. */
export async function getRegimeComparisonForYear(
  supabase: SupabaseClient<Database>,
  ruleSet: TaxRuleSet,
  fy: FinancialYear,
): Promise<RegimeComparisonAvailability> {
  const profile = await getTaxProfile(supabase);
  if (!profile) {
    return { available: false, reasonCode: "no_profile" };
  }
  if (!isProfileWithinSupportedScope(profile)) {
    return { available: false, reasonCode: "unsupported_profile" };
  }

  const [incomeAdjustments, deductions, withholdings, payments, capitalGains] =
    await Promise.all([
      listTaxIncomeAdjustments(supabase, fy.id),
      listTaxDeductions(supabase, fy.id),
      listTaxWithholdings(supabase, fy.id),
      listTaxPayments(supabase, fy.id),
      getCapitalGainsReportForYear(supabase, ruleSet, fy),
    ]);

  const confirmedIncome = incomeAdjustments.filter(
    (i) => i.status === "confirmed" && !i.isExemptCandidate,
  );
  const grossOrdinaryIncome = confirmedIncome.reduce(
    (sum, i) => sum.plus(i.netAmount.plus(i.tdsAmount)),
    new Decimal(0),
  );

  const confirmedDeductions = deductions.filter(
    (d) => d.status === "confirmed",
  );
  const oldRegimeDeductions = confirmedDeductions.reduce((sum, d) => {
    const rule = ruleSet.deductionCatalog.find((c) => c.section === d.section);
    if (!rule || !rule.regimes.includes("old")) {
      return sum;
    }
    const capped = rule.maxAmount
      ? Decimal.min(d.claimedAmount, rule.maxAmount)
      : d.claimedAmount;
    return sum.plus(capped);
  }, new Decimal(0));
  const newRegimeDeductions = confirmedDeductions.reduce((sum, d) => {
    const rule = ruleSet.deductionCatalog.find((c) => c.section === d.section);
    if (!rule || !rule.regimes.includes("new")) {
      return sum;
    }
    const capped = rule.maxAmount
      ? Decimal.min(d.claimedAmount, rule.maxAmount)
      : d.claimedAmount;
    return sum.plus(capped);
  }, new Decimal(0));

  const taxWithheld = withholdings.reduce(
    (sum, w) => sum.plus(w.taxWithheld),
    new Decimal(0),
  );
  const taxPaidDirectly = payments
    .filter((p) => p.paymentType !== "refund")
    .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
  const taxAlreadyPaid = taxWithheld.plus(taxPaidDirectly);

  const result = compareRegimes({
    ruleSet,
    grossOrdinaryIncome,
    hasSalaryOrPensionIncome: profile.hasSalaryOrPensionIncome,
    oldRegimeDeductions,
    newRegimeDeductions,
    capitalGains: capitalGains.report,
    taxAlreadyPaid,
  });

  return {
    available: true,
    result,
    hasSalaryOrPensionIncome: profile.hasSalaryOrPensionIncome,
  };
}
