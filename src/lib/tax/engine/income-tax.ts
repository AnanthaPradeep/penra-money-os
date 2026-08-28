import { Decimal, type Money } from "@/lib/money/decimal";
import type { TaxRegimeKind, TaxRuleSet } from "@/lib/tax/rules/types";

/**
 * Pure, deterministic ordinary-income slab-tax calculator over one
 * already-selected TaxRuleSet/regime — never reads the registry itself,
 * never touches the database, never posts anything. Surcharge is
 * calculated only up to each regime's own `surchargeSupportedUpToIncome`
 * threshold; above it, the result is explicitly "partial" with a reason
 * code rather than an approximated surcharge/marginal-relief figure — see
 * the module comment on RegimeRules.surchargeSupportedUpToIncome in
 * src/lib/tax/rules/types.ts for why that line is drawn there instead of
 * attempting the full surcharge-slab-plus-marginal-relief calculation.
 */

export type TaxCalculationStatus = "available" | "partial" | "unavailable";

export type IncomeTaxReasonCode =
  | "surcharge_unsupported_above_threshold"
  | "negative_taxable_income";

export type SlabTaxBreakdownLine = {
  from: Money;
  to: Money | null;
  ratePercent: Money;
  taxableInBand: Money;
  taxForBand: Money;
};

export type IncomeTaxCalculation = {
  status: TaxCalculationStatus;
  regime: TaxRegimeKind;
  financialYearId: string;
  assessmentYearId: string;
  ruleSetVersion: string;
  taxableOrdinaryIncome: Money;
  slabBreakdown: SlabTaxBreakdownLine[];
  slabTax: Money;
  rebateApplied: Money;
  taxAfterRebate: Money;
  surchargeApplied: Money;
  cessApplied: Money;
  /** taxAfterRebate + surchargeApplied + cessApplied. */
  totalOrdinaryTax: Money;
  reasonCodes: IncomeTaxReasonCode[];
  calculatedAt: string;
};

const ZERO = new Decimal(0);

function computeSlabTax(
  slabs: TaxRuleSet["regimes"][TaxRegimeKind]["slabs"],
  taxableIncome: Money,
): { breakdown: SlabTaxBreakdownLine[]; total: Money } {
  const breakdown: SlabTaxBreakdownLine[] = [];
  let total = ZERO;

  for (const band of slabs) {
    const bandFloor = band.from;
    const bandCeiling = band.to;
    if (taxableIncome.lte(bandFloor)) {
      break;
    }
    const bandTop = bandCeiling === null ? taxableIncome : Decimal.min(bandCeiling, taxableIncome);
    const taxableInBand = bandTop.minus(bandFloor);
    if (taxableInBand.lte(0)) {
      continue;
    }
    const taxForBand = taxableInBand.times(band.ratePercent).dividedBy(100);
    breakdown.push({
      from: bandFloor,
      to: bandCeiling,
      ratePercent: band.ratePercent,
      taxableInBand,
      taxForBand,
    });
    total = total.plus(taxForBand);
  }

  return { breakdown, total };
}

/** Calculates ordinary-income slab tax, section-87A rebate, cess, and (where supported) surcharge for one regime under one rule set. */
export function calculateOrdinarySlabTax(
  ruleSet: TaxRuleSet,
  regime: TaxRegimeKind,
  taxableOrdinaryIncome: Money,
  now: Date = new Date(),
): IncomeTaxCalculation {
  const regimeRules = ruleSet.regimes[regime];
  const reasonCodes: IncomeTaxReasonCode[] = [];

  const base = {
    regime,
    financialYearId: ruleSet.financialYearId,
    assessmentYearId: ruleSet.assessmentYearId,
    ruleSetVersion: ruleSet.ruleSetVersion,
    taxableOrdinaryIncome,
    calculatedAt: now.toISOString(),
  };

  if (taxableOrdinaryIncome.isNegative()) {
    return {
      ...base,
      status: "unavailable",
      slabBreakdown: [],
      slabTax: ZERO,
      rebateApplied: ZERO,
      taxAfterRebate: ZERO,
      surchargeApplied: ZERO,
      cessApplied: ZERO,
      totalOrdinaryTax: ZERO,
      reasonCodes: ["negative_taxable_income"],
    };
  }

  const { breakdown, total: slabTax } = computeSlabTax(
    regimeRules.slabs,
    taxableOrdinaryIncome,
  );

  const rebateApplied = taxableOrdinaryIncome.lte(regimeRules.rebate.thresholdIncome)
    ? Decimal.min(slabTax, regimeRules.rebate.maxRebateAmount)
    : ZERO;
  const taxAfterRebate = slabTax.minus(rebateApplied);

  const surchargeApplied = ZERO;
  let status: TaxCalculationStatus = "available";
  if (taxableOrdinaryIncome.gt(regimeRules.surchargeSupportedUpToIncome)) {
    status = "partial";
    reasonCodes.push("surcharge_unsupported_above_threshold");
  }
  // Below the supported threshold, no surcharge slab applies at all for
  // an individual taxpayer under either regime (surcharge only begins
  // above ₹50,00,000) — so surchargeApplied correctly stays zero here.

  const cessApplied = taxAfterRebate
    .plus(surchargeApplied)
    .times(regimeRules.cessPercent)
    .dividedBy(100);

  const totalOrdinaryTax = taxAfterRebate.plus(surchargeApplied).plus(cessApplied);

  return {
    ...base,
    status,
    slabBreakdown: breakdown,
    slabTax,
    rebateApplied,
    taxAfterRebate,
    surchargeApplied,
    cessApplied,
    totalOrdinaryTax,
    reasonCodes,
  };
}
