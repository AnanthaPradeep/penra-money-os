import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import {
  computeCurrentRatio,
  computeDebtToEquity,
  computeDividendYield,
  computeEpsGrowth,
  computeFreeCashFlowConversion,
  computeFreeCashFlowMargin,
  computeGrossMargin,
  computeInterestCoverage,
  computeNetIncomeGrowth,
  computeNetProfitMargin,
  computeOperatingCashFlowMargin,
  computeOperatingMargin,
  computePriceToBook,
  computePriceToEarnings,
  computePriceToSales,
  computeReturnOnAssets,
  computeReturnOnEquity,
  computeRevenueGrowth,
  RATIO_FORMULA_VERSION,
  type PriceRatioInput,
} from "@/lib/research/ratios";

const d = (n: number) => new Decimal(n);

describe("computeRevenueGrowth", () => {
  it("computes a simple positive growth percentage", () => {
    const result = computeRevenueGrowth(d(1100), d(1000));
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.value.toString()).toBe("10");
      expect(result.formulaVersion).toBe(RATIO_FORMULA_VERSION);
    }
  });

  it("computes a negative growth percentage (a decline)", () => {
    const result = computeRevenueGrowth(d(900), d(1000));
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.value.toString()).toBe("-10");
    }
  });

  it("is unavailable rather than dividing by zero when the prior period was zero", () => {
    const result = computeRevenueGrowth(d(500), d(0));
    expect(result).toEqual({
      status: "unavailable",
      reason: "zero_denominator",
    });
  });

  it("is unavailable (never a fabricated percentage) when the prior period was negative", () => {
    const result = computeRevenueGrowth(d(500), d(-100));
    expect(result).toEqual({ status: "unavailable", reason: "negative_base" });
  });

  it("is unavailable when either input is missing", () => {
    expect(computeRevenueGrowth(null, d(1000))).toEqual({
      status: "unavailable",
      reason: "missing_input",
    });
    expect(computeRevenueGrowth(d(1000), null)).toEqual({
      status: "unavailable",
      reason: "missing_input",
    });
  });
});

describe("computeNetIncomeGrowth / computeEpsGrowth", () => {
  it("apply the same growth formula", () => {
    expect(computeNetIncomeGrowth(d(220), d(200))).toEqual({
      status: "available",
      value: d(10),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
    expect(computeEpsGrowth(d(11), d(10))).toEqual({
      status: "available",
      value: d(10),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });
});

describe("margin ratios", () => {
  it("computes gross margin as a percentage", () => {
    const result = computeGrossMargin(d(400), d(1000));
    expect(result).toEqual({
      status: "available",
      value: d(40),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("computes operating margin", () => {
    const result = computeOperatingMargin(d(150), d(1000));
    expect(result).toEqual({
      status: "available",
      value: d(15),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("computes net profit margin, including a negative margin for a loss", () => {
    const result = computeNetProfitMargin(d(-50), d(1000));
    expect(result).toEqual({
      status: "available",
      value: d(-5),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("is unavailable when revenue is zero", () => {
    expect(computeGrossMargin(d(400), d(0))).toEqual({
      status: "unavailable",
      reason: "zero_denominator",
    });
  });
});

describe("computeReturnOnEquity / computeReturnOnAssets", () => {
  it("computes ROE for positive equity", () => {
    const result = computeReturnOnEquity(d(200), d(1000));
    expect(result).toEqual({
      status: "available",
      value: d(20),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("is unavailable (not a misleadingly-signed number) when equity is negative", () => {
    const result = computeReturnOnEquity(d(200), d(-500));
    expect(result).toEqual({
      status: "unavailable",
      reason: "negative_denominator",
    });
  });

  it("computes ROA for positive total assets", () => {
    const result = computeReturnOnAssets(d(100), d(2000));
    expect(result).toEqual({
      status: "available",
      value: d(5),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("is unavailable when total assets is zero", () => {
    expect(computeReturnOnAssets(d(100), d(0))).toEqual({
      status: "unavailable",
      reason: "zero_denominator",
    });
  });
});

describe("computeDebtToEquity / computeCurrentRatio / computeInterestCoverage", () => {
  it("computes debt-to-equity as a bare multiple, not a percentage", () => {
    const result = computeDebtToEquity(d(500), d(1000));
    expect(result).toEqual({
      status: "available",
      value: d(0.5),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("is unavailable for negative equity", () => {
    expect(computeDebtToEquity(d(500), d(-1000))).toEqual({
      status: "unavailable",
      reason: "negative_denominator",
    });
  });

  it("computes the current ratio", () => {
    const result = computeCurrentRatio(d(300), d(150));
    expect(result).toEqual({
      status: "available",
      value: d(2),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("computes interest coverage", () => {
    const result = computeInterestCoverage(d(400), d(50));
    expect(result).toEqual({
      status: "available",
      value: d(8),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("is unavailable when there is no interest expense reported (zero)", () => {
    expect(computeInterestCoverage(d(400), d(0))).toEqual({
      status: "unavailable",
      reason: "zero_denominator",
    });
  });
});

describe("cash-flow ratios", () => {
  it("computes operating cash flow margin", () => {
    const result = computeOperatingCashFlowMargin(d(180), d(1000));
    expect(result).toEqual({
      status: "available",
      value: d(18),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("computes free cash flow margin", () => {
    const result = computeFreeCashFlowMargin(d(120), d(1000));
    expect(result).toEqual({
      status: "available",
      value: d(12),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("computes free cash flow conversion against net income", () => {
    const result = computeFreeCashFlowConversion(d(150), d(200));
    expect(result).toEqual({
      status: "available",
      value: d(75),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("is unavailable for free cash flow conversion when net income is negative (a loss)", () => {
    expect(computeFreeCashFlowConversion(d(150), d(-50))).toEqual({
      status: "unavailable",
      reason: "negative_denominator",
    });
  });
});

describe("price-based ratios", () => {
  const priceInput: PriceRatioInput = {
    marketPrice: d(100),
    priceCurrency: "INR",
    sharesOutstanding: d(10),
    statementCurrency: "INR",
  };

  it("computes P/E from market cap and net income", () => {
    // market cap = 100 * 10 = 1000; net income = 100 -> P/E = 10
    const result = computePriceToEarnings(priceInput, d(100));
    expect(result).toEqual({
      status: "available",
      value: d(10),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("computes P/B from market cap and shareholder equity", () => {
    const result = computePriceToBook(priceInput, d(500));
    expect(result).toEqual({
      status: "available",
      value: d(2),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("computes P/S from market cap and revenue", () => {
    const result = computePriceToSales(priceInput, d(2000));
    expect(result).toEqual({
      status: "available",
      value: d(0.5),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("computes dividend yield using the absolute value of dividends paid", () => {
    // dividends paid stored as a negative cash outflow of -50; market cap = 1000
    const result = computeDividendYield(priceInput, d(-50));
    expect(result).toEqual({
      status: "available",
      value: d(5),
      formulaVersion: RATIO_FORMULA_VERSION,
    });
  });

  it("never silently mixes currencies — a mismatch is unavailable", () => {
    const usdInput: PriceRatioInput = { ...priceInput, priceCurrency: "USD" };
    const result = computePriceToEarnings(usdInput, d(100));
    expect(result).toEqual({
      status: "unavailable",
      reason: "currency_mismatch",
    });
  });

  it("is unavailable when shares outstanding is missing", () => {
    const noShares: PriceRatioInput = {
      ...priceInput,
      sharesOutstanding: null,
    };
    const result = computePriceToEarnings(noShares, d(100));
    expect(result).toEqual({ status: "unavailable", reason: "missing_input" });
  });

  it("is unavailable for P/E when net income is negative (a loss makes P/E undefined in the conventional sense)", () => {
    const result = computePriceToEarnings(priceInput, d(-50));
    expect(result).toEqual({
      status: "unavailable",
      reason: "negative_denominator",
    });
  });
});
