import { Decimal, type Money } from "@/lib/money/decimal";
import type { CapitalGainsReport } from "@/lib/tax/engine/capital-gains";
import {
  calculateOrdinarySlabTax,
  type IncomeTaxCalculation,
  type TaxCalculationStatus,
} from "@/lib/tax/engine/income-tax";
import type { TaxRegimeKind, TaxRuleSet } from "@/lib/tax/rules/types";

/**
 * Combines the ordinary-slab calculator and an already-built capital-
 * gains report into a neutral, exact-decimal old-vs-new regime estimate.
 * This module NEVER recommends a regime — no field here is named or
 * shaped like "best"/"recommended"; `differenceOldMinusNew` is a signed
 * arithmetic difference only, for the UI to display neutrally, never as
 * advice. Capital-gains special-rate tax does not depend on which
 * ordinary-income regime is chosen (the same rates apply to both), so it
 * is added identically to both estimates.
 */

export type RegimeEstimate = {
  regime: TaxRegimeKind;
  status: TaxCalculationStatus;
  grossOrdinaryIncome: Money;
  standardDeduction: Money;
  deductionsApplied: Money;
  taxableOrdinaryIncome: Money;
  ordinaryTax: IncomeTaxCalculation;
  specialRateTax: Money;
  totalTaxLiability: Money;
  taxAlreadyPaid: Money;
  /** Positive = balance payable; negative = refund due. */
  balancePayableOrRefund: Money;
};

export type RegimeComparisonResult = {
  financialYearId: string;
  assessmentYearId: string;
  ruleSetVersion: string;
  calculatedAt: string;
  old: RegimeEstimate;
  new: RegimeEstimate;
  /** old.totalTaxLiability − new.totalTaxLiability. Positive means the old regime's estimated liability is higher — an arithmetic fact only, never a recommendation. */
  differenceOldMinusNew: Money;
};

export type RegimeComparisonInput = {
  ruleSet: TaxRuleSet;
  grossOrdinaryIncome: Money;
  hasSalaryOrPensionIncome: boolean;
  oldRegimeDeductions: Money;
  newRegimeDeductions: Money;
  capitalGains: CapitalGainsReport;
  taxAlreadyPaid: Money;
  now?: Date;
};

const ZERO = new Decimal(0);

function buildEstimate(
  ruleSet: TaxRuleSet,
  regime: TaxRegimeKind,
  input: RegimeComparisonInput,
  now: Date,
): RegimeEstimate {
  const regimeRules = ruleSet.regimes[regime];
  const standardDeduction =
    input.hasSalaryOrPensionIncome && regimeRules.standardDeduction
      ? regimeRules.standardDeduction
      : ZERO;
  const deductionsApplied =
    regime === "old" ? input.oldRegimeDeductions : input.newRegimeDeductions;

  const taxableOrdinaryIncome = Decimal.max(
    ZERO,
    input.grossOrdinaryIncome.minus(standardDeduction).minus(deductionsApplied),
  );

  const ordinaryTax = calculateOrdinarySlabTax(
    ruleSet,
    regime,
    taxableOrdinaryIncome,
    now,
  );

  const specialRateTax = input.capitalGains.ltcgSpecialRateTax.plus(
    input.capitalGains.stcgSpecialRateTax,
  );

  const totalTaxLiability = ordinaryTax.totalOrdinaryTax.plus(specialRateTax);
  const balancePayableOrRefund = totalTaxLiability.minus(input.taxAlreadyPaid);

  const status: TaxCalculationStatus =
    ordinaryTax.status === "unavailable"
      ? "unavailable"
      : ordinaryTax.status === "partial" ||
          input.capitalGains.status === "partial"
        ? "partial"
        : "available";

  return {
    regime,
    status,
    grossOrdinaryIncome: input.grossOrdinaryIncome,
    standardDeduction,
    deductionsApplied,
    taxableOrdinaryIncome,
    ordinaryTax,
    specialRateTax,
    totalTaxLiability,
    taxAlreadyPaid: input.taxAlreadyPaid,
    balancePayableOrRefund,
  };
}

export function compareRegimes(
  input: RegimeComparisonInput,
): RegimeComparisonResult {
  const now = input.now ?? new Date();
  const oldEstimate = buildEstimate(input.ruleSet, "old", input, now);
  const newEstimate = buildEstimate(input.ruleSet, "new", input, now);

  return {
    financialYearId: input.ruleSet.financialYearId,
    assessmentYearId: input.ruleSet.assessmentYearId,
    ruleSetVersion: input.ruleSet.ruleSetVersion,
    calculatedAt: now.toISOString(),
    old: oldEstimate,
    new: newEstimate,
    differenceOldMinusNew: oldEstimate.totalTaxLiability.minus(
      newEstimate.totalTaxLiability,
    ),
  };
}
