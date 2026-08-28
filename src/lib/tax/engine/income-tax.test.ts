import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import { calculateOrdinarySlabTax } from "@/lib/tax/engine/income-tax";
import { FY_2025_26 } from "@/lib/tax/rules/fy2025-26";

const FIXED_NOW = new Date("2026-08-27T00:00:00.000Z");

describe("calculateOrdinarySlabTax — new regime FY2025-26", () => {
  it("charges zero tax at or below the rebate threshold (₹12,00,000)", () => {
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "new",
      new Decimal(1200000),
      FIXED_NOW,
    );
    expect(result.status).toBe("available");
    expect(result.rebateApplied.toString()).toBe(result.slabTax.toString());
    expect(result.totalOrdinaryTax.toString()).toBe("0");
  });

  it("computes slab tax across multiple bands correctly for ₹20,00,000 taxable income", () => {
    // Bands: 0-4L@0, 4-8L@5%(=20000), 8-12L@10%(=40000), 12-16L@15%(=60000), 16-20L@20%(=80000).
    // Total slab tax = 20000+40000+60000+80000 = 200000.
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "new",
      new Decimal(2000000),
      FIXED_NOW,
    );
    expect(result.slabTax.toString()).toBe("200000");
    expect(result.rebateApplied.toString()).toBe("0");
    // Cess = 4% of 200000 = 8000. Total = 208000.
    expect(result.cessApplied.toString()).toBe("8000");
    expect(result.totalOrdinaryTax.toString()).toBe("208000");
    expect(result.status).toBe("available");
  });

  it("produces a slab breakdown whose bands sum back to the total slab tax", () => {
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "new",
      new Decimal(2500000),
      FIXED_NOW,
    );
    const summed = result.slabBreakdown.reduce(
      (sum, line) => sum.plus(line.taxForBand),
      new Decimal(0),
    );
    expect(summed.toString()).toBe(result.slabTax.toString());
  });

  it("marks the calculation partial with a reason code above the supported surcharge threshold, never approximating surcharge", () => {
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "new",
      new Decimal(6000000), // above ₹50,00,000
      FIXED_NOW,
    );
    expect(result.status).toBe("partial");
    expect(result.reasonCodes).toContain("surcharge_unsupported_above_threshold");
    expect(result.surchargeApplied.toString()).toBe("0");
  });

  it("stays available exactly at the supported surcharge threshold", () => {
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "new",
      new Decimal(5000000),
      FIXED_NOW,
    );
    expect(result.status).toBe("available");
  });

  it("returns unavailable for negative taxable income rather than a negative tax figure", () => {
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "new",
      new Decimal(-100),
      FIXED_NOW,
    );
    expect(result.status).toBe("unavailable");
    expect(result.reasonCodes).toContain("negative_taxable_income");
  });

  it("charges zero tax on zero income", () => {
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "new",
      new Decimal(0),
      FIXED_NOW,
    );
    expect(result.totalOrdinaryTax.toString()).toBe("0");
  });
});

describe("calculateOrdinarySlabTax — old regime FY2025-26", () => {
  it("charges zero tax at the ₹5,00,000 rebate threshold", () => {
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "old",
      new Decimal(500000),
      FIXED_NOW,
    );
    expect(result.totalOrdinaryTax.toString()).toBe("0");
  });

  it("computes tax above the rebate threshold with cess applied", () => {
    // 0-2.5L@0, 2.5-5L@5%(=12500), 5-6L@20%(=20000) => slabTax = 32500.
    const result = calculateOrdinarySlabTax(
      FY_2025_26,
      "old",
      new Decimal(600000),
      FIXED_NOW,
    );
    expect(result.slabTax.toString()).toBe("32500");
    expect(result.rebateApplied.toString()).toBe("0");
    // cess = 4% of 32500 = 1300.
    expect(result.cessApplied.toString()).toBe("1300");
    expect(result.totalOrdinaryTax.toString()).toBe("33800");
  });
});

describe("calculateOrdinarySlabTax — never NaN or Infinity", () => {
  it("stays finite across a wide sweep of taxable incomes", () => {
    for (const amount of [0, 1, 250000, 1200000, 5000000, 50000000, 999999999]) {
      const result = calculateOrdinarySlabTax(
        FY_2025_26,
        "new",
        new Decimal(amount),
        FIXED_NOW,
      );
      expect(result.totalOrdinaryTax.isFinite()).toBe(true);
      expect(result.slabTax.isFinite()).toBe(true);
    }
  });
});
