import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import { compareRegimes } from "@/lib/tax/engine/regime-comparison";
import type { CapitalGainsReport } from "@/lib/tax/engine/capital-gains";
import { FY_2025_26 } from "@/lib/tax/rules/fy2025-26";

const FIXED_NOW = new Date("2026-08-27T00:00:00.000Z");

function emptyCapitalGains(): CapitalGainsReport {
  return {
    lines: [],
    categoryTotals: [],
    ltcgExemptionApplied: new Decimal(0),
    ltcgTaxableAfterExemption: new Decimal(0),
    ltcgSpecialRateTax: new Decimal(0),
    stcgSpecialRateTax: new Decimal(0),
    totalGains: new Decimal(0),
    totalLosses: new Decimal(0),
    unclassifiedOrUnsupportedCount: 0,
    status: "complete",
  };
}

describe("compareRegimes", () => {
  it("applies each regime's own standard deduction and deduction totals independently", () => {
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(1500000),
      hasSalaryOrPensionIncome: true,
      oldRegimeDeductions: new Decimal(150000), // e.g. 80C
      newRegimeDeductions: new Decimal(0),
      capitalGains: emptyCapitalGains(),
      taxAlreadyPaid: new Decimal(0),
      now: FIXED_NOW,
    });

    // Old: 1500000 - 50000 (std ded) - 150000 (80C) = 1300000 taxable.
    expect(result.old.taxableOrdinaryIncome.toString()).toBe("1300000");
    // New: 1500000 - 75000 (std ded) - 0 = 1425000 taxable.
    expect(result.new.taxableOrdinaryIncome.toString()).toBe("1425000");
  });

  it("never recommends a regime — the result carries only a signed arithmetic difference", () => {
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(1200000),
      hasSalaryOrPensionIncome: true,
      oldRegimeDeductions: new Decimal(0),
      newRegimeDeductions: new Decimal(0),
      capitalGains: emptyCapitalGains(),
      taxAlreadyPaid: new Decimal(0),
      now: FIXED_NOW,
    });

    expect(result.differenceOldMinusNew.toString()).toBe(
      result.old.totalTaxLiability.minus(result.new.totalTaxLiability).toString(),
    );
    expect(Object.keys(result)).not.toContain("recommendedRegime");
    expect(Object.keys(result)).not.toContain("best");
  });

  it("adds the same special-rate capital-gains tax to both regime estimates", () => {
    const capitalGains: CapitalGainsReport = {
      ...emptyCapitalGains(),
      ltcgSpecialRateTax: new Decimal(5000),
      stcgSpecialRateTax: new Decimal(2000),
    };
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(1000000),
      hasSalaryOrPensionIncome: true,
      oldRegimeDeductions: new Decimal(0),
      newRegimeDeductions: new Decimal(0),
      capitalGains,
      taxAlreadyPaid: new Decimal(0),
      now: FIXED_NOW,
    });
    expect(result.old.specialRateTax.toString()).toBe("7000");
    expect(result.new.specialRateTax.toString()).toBe("7000");
  });

  it("computes a positive balance payable when tax already paid is less than total liability", () => {
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(2000000),
      hasSalaryOrPensionIncome: true,
      oldRegimeDeductions: new Decimal(0),
      newRegimeDeductions: new Decimal(0),
      capitalGains: emptyCapitalGains(),
      taxAlreadyPaid: new Decimal(10000),
      now: FIXED_NOW,
    });
    expect(result.new.balancePayableOrRefund.gt(0)).toBe(true);
  });

  it("computes a negative balance (refund) when tax already paid exceeds total liability", () => {
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(1200000),
      hasSalaryOrPensionIncome: true,
      oldRegimeDeductions: new Decimal(0),
      newRegimeDeductions: new Decimal(0),
      capitalGains: emptyCapitalGains(),
      taxAlreadyPaid: new Decimal(50000),
      now: FIXED_NOW,
    });
    expect(result.new.balancePayableOrRefund.isNegative()).toBe(true);
  });

  it("marks a regime partial when the underlying ordinary-tax calculation is partial (surcharge above the supported threshold)", () => {
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(6000000),
      hasSalaryOrPensionIncome: true,
      oldRegimeDeductions: new Decimal(0),
      newRegimeDeductions: new Decimal(0),
      capitalGains: emptyCapitalGains(),
      taxAlreadyPaid: new Decimal(0),
      now: FIXED_NOW,
    });
    expect(result.old.status).toBe("partial");
    expect(result.new.status).toBe("partial");
  });

  it("never applies a standard deduction when there is no salary/pension income", () => {
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(500000),
      hasSalaryOrPensionIncome: false,
      oldRegimeDeductions: new Decimal(0),
      newRegimeDeductions: new Decimal(0),
      capitalGains: emptyCapitalGains(),
      taxAlreadyPaid: new Decimal(0),
      now: FIXED_NOW,
    });
    expect(result.old.standardDeduction.toString()).toBe("0");
    expect(result.new.standardDeduction.toString()).toBe("0");
  });

  it("never lets taxable ordinary income go negative even when deductions exceed gross income", () => {
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(100000),
      hasSalaryOrPensionIncome: true,
      oldRegimeDeductions: new Decimal(500000),
      newRegimeDeductions: new Decimal(0),
      capitalGains: emptyCapitalGains(),
      taxAlreadyPaid: new Decimal(0),
      now: FIXED_NOW,
    });
    expect(result.old.taxableOrdinaryIncome.toString()).toBe("0");
  });

  it("carries the rule set's financial year, assessment year, and version onto the result", () => {
    const result = compareRegimes({
      ruleSet: FY_2025_26,
      grossOrdinaryIncome: new Decimal(1000000),
      hasSalaryOrPensionIncome: true,
      oldRegimeDeductions: new Decimal(0),
      newRegimeDeductions: new Decimal(0),
      capitalGains: emptyCapitalGains(),
      taxAlreadyPaid: new Decimal(0),
      now: FIXED_NOW,
    });
    expect(result.financialYearId).toBe("2025-26");
    expect(result.assessmentYearId).toBe("2026-27");
    expect(result.ruleSetVersion).toBe("in-individual-2025-26.v1");
  });
});
