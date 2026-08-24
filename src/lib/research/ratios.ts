import type { Decimal, Money } from "@/lib/money/decimal";

/**
 * Every ratio here carries the formula version it was computed with, so a
 * later change to a formula's definition never silently reinterprets a
 * value shown/exported earlier — see spec section 7 ("record the formula
 * version"). Bump this whenever a formula's definition changes.
 */
export const RATIO_FORMULA_VERSION = "v1";

export type RatioUnavailableReason =
  | "missing_input"
  | "zero_denominator"
  | "negative_denominator"
  | "negative_base"
  | "currency_mismatch"
  | "incompatible_periods";

export type RatioResult =
  | { status: "available"; value: Decimal; formulaVersion: string }
  | { status: "unavailable"; reason: RatioUnavailableReason };

const UNAVAILABLE_MISSING: RatioResult = {
  status: "unavailable",
  reason: "missing_input",
};

function available(value: Decimal): RatioResult {
  return { status: "available", value, formulaVersion: RATIO_FORMULA_VERSION };
}

/** A ratio (times-100 for a percentage margin, or a bare multiple) — never divides by a zero or negative denominator, never returns NaN/Infinity, and treats a missing input as unavailable rather than a fabricated zero. `denominatorMustBePositive` controls whether a negative denominator is rejected outright (the typical case for equity/assets-based ratios, where a negative base makes the usual interpretation meaningless) or simply computed through (some ratios, like margins, are still meaningful with a negative numerator over a positive denominator — a loss margin). */
function safeRatio(
  numerator: Money | null,
  denominator: Money | null,
  options: { asPercent?: boolean; denominatorMustBePositive?: boolean } = {},
): RatioResult {
  if (numerator === null || denominator === null) {
    return UNAVAILABLE_MISSING;
  }
  if (denominator.isZero()) {
    return { status: "unavailable", reason: "zero_denominator" };
  }
  if (options.denominatorMustBePositive && denominator.isNegative()) {
    return { status: "unavailable", reason: "negative_denominator" };
  }

  const ratio = numerator.dividedBy(denominator);
  if (!ratio.isFinite()) {
    return { status: "unavailable", reason: "zero_denominator" };
  }

  return available(options.asPercent ? ratio.times(100) : ratio);
}

/** Period-over-period growth as a percentage. A non-positive prior-period value makes a percentage-growth figure directionally misleading (e.g. growing "from -100 to +50"), so it is deliberately reported unavailable rather than computed. */
export function computeGrowth(
  current: Money | null,
  prior: Money | null,
): RatioResult {
  if (current === null || prior === null) {
    return UNAVAILABLE_MISSING;
  }
  if (prior.isZero()) {
    return { status: "unavailable", reason: "zero_denominator" };
  }
  if (prior.isNegative()) {
    return { status: "unavailable", reason: "negative_base" };
  }

  return available(current.minus(prior).dividedBy(prior).times(100));
}

export function computeRevenueGrowth(
  currentRevenue: Money | null,
  priorRevenue: Money | null,
): RatioResult {
  return computeGrowth(currentRevenue, priorRevenue);
}

export function computeNetIncomeGrowth(
  currentNetIncome: Money | null,
  priorNetIncome: Money | null,
): RatioResult {
  return computeGrowth(currentNetIncome, priorNetIncome);
}

export function computeEpsGrowth(
  currentEps: Money | null,
  priorEps: Money | null,
): RatioResult {
  return computeGrowth(currentEps, priorEps);
}

export function computeGrossMargin(
  grossProfit: Money | null,
  revenue: Money | null,
): RatioResult {
  return safeRatio(grossProfit, revenue, { asPercent: true });
}

export function computeOperatingMargin(
  operatingIncome: Money | null,
  revenue: Money | null,
): RatioResult {
  return safeRatio(operatingIncome, revenue, { asPercent: true });
}

export function computeNetProfitMargin(
  netIncome: Money | null,
  revenue: Money | null,
): RatioResult {
  return safeRatio(netIncome, revenue, { asPercent: true });
}

/** Return on equity: negative shareholder equity makes the conventional ROE reading meaningless (a "return" on a negative base), so it is reported unavailable rather than a misleadingly-signed number. */
export function computeReturnOnEquity(
  netIncome: Money | null,
  shareholderEquity: Money | null,
): RatioResult {
  return safeRatio(netIncome, shareholderEquity, {
    asPercent: true,
    denominatorMustBePositive: true,
  });
}

export function computeReturnOnAssets(
  netIncome: Money | null,
  totalAssets: Money | null,
): RatioResult {
  return safeRatio(netIncome, totalAssets, {
    asPercent: true,
    denominatorMustBePositive: true,
  });
}

export function computeDebtToEquity(
  totalDebt: Money | null,
  shareholderEquity: Money | null,
): RatioResult {
  return safeRatio(totalDebt, shareholderEquity, {
    denominatorMustBePositive: true,
  });
}

export function computeCurrentRatio(
  currentAssets: Money | null,
  currentLiabilities: Money | null,
): RatioResult {
  return safeRatio(currentAssets, currentLiabilities, {
    denominatorMustBePositive: true,
  });
}

export function computeInterestCoverage(
  operatingIncome: Money | null,
  interestExpense: Money | null,
): RatioResult {
  return safeRatio(operatingIncome, interestExpense, {
    denominatorMustBePositive: true,
  });
}

export function computeOperatingCashFlowMargin(
  operatingCashFlow: Money | null,
  revenue: Money | null,
): RatioResult {
  return safeRatio(operatingCashFlow, revenue, { asPercent: true });
}

export function computeFreeCashFlowMargin(
  freeCashFlow: Money | null,
  revenue: Money | null,
): RatioResult {
  return safeRatio(freeCashFlow, revenue, { asPercent: true });
}

/** Free-cash-flow conversion: how much of reported net income actually turned into free cash flow. A non-positive net income makes the usual "% of profit converted to cash" reading meaningless. */
export function computeFreeCashFlowConversion(
  freeCashFlow: Money | null,
  netIncome: Money | null,
): RatioResult {
  return safeRatio(freeCashFlow, netIncome, {
    asPercent: true,
    denominatorMustBePositive: true,
  });
}

export type PriceRatioInput = {
  marketPrice: Money;
  priceCurrency: string;
  sharesOutstanding: Money | null;
  statementCurrency: string;
};

/** Every price-based ratio requires the metric and the market price to share the same currency — this app never silently performs an FX conversion (spec section 7). */
function requireSameCurrency(
  priceCurrency: string,
  statementCurrency: string,
): RatioResult | null {
  if (priceCurrency !== statementCurrency) {
    return { status: "unavailable", reason: "currency_mismatch" };
  }
  return null;
}

export function computePriceToEarnings(
  input: PriceRatioInput,
  netIncome: Money | null,
): RatioResult {
  const mismatch = requireSameCurrency(
    input.priceCurrency,
    input.statementCurrency,
  );
  if (mismatch) {
    return mismatch;
  }
  if (input.sharesOutstanding === null || netIncome === null) {
    return UNAVAILABLE_MISSING;
  }
  const marketCap = input.marketPrice.times(input.sharesOutstanding);
  return safeRatio(marketCap, netIncome, { denominatorMustBePositive: true });
}

export function computePriceToBook(
  input: PriceRatioInput,
  shareholderEquity: Money | null,
): RatioResult {
  const mismatch = requireSameCurrency(
    input.priceCurrency,
    input.statementCurrency,
  );
  if (mismatch) {
    return mismatch;
  }
  if (input.sharesOutstanding === null || shareholderEquity === null) {
    return UNAVAILABLE_MISSING;
  }
  const marketCap = input.marketPrice.times(input.sharesOutstanding);
  return safeRatio(marketCap, shareholderEquity, {
    denominatorMustBePositive: true,
  });
}

export function computePriceToSales(
  input: PriceRatioInput,
  revenue: Money | null,
): RatioResult {
  const mismatch = requireSameCurrency(
    input.priceCurrency,
    input.statementCurrency,
  );
  if (mismatch) {
    return mismatch;
  }
  if (input.sharesOutstanding === null || revenue === null) {
    return UNAVAILABLE_MISSING;
  }
  const marketCap = input.marketPrice.times(input.sharesOutstanding);
  return safeRatio(marketCap, revenue, { denominatorMustBePositive: true });
}

/** Trailing dividend yield from the most recent annual dividends-paid figure — a coarse approximation (not a forward/declared yield), always labelled as such by the caller. */
export function computeDividendYield(
  input: PriceRatioInput,
  dividendsPaid: Money | null,
): RatioResult {
  const mismatch = requireSameCurrency(
    input.priceCurrency,
    input.statementCurrency,
  );
  if (mismatch) {
    return mismatch;
  }
  if (input.sharesOutstanding === null || dividendsPaid === null) {
    return UNAVAILABLE_MISSING;
  }
  // dividends_paid is a cash outflow (should be reported as a negative or
  // zero-or-positive magnitude depending on provider convention) — always
  // use its absolute value, since "yield" is inherently a non-negative
  // concept for the purpose of this display.
  const marketCap = input.marketPrice.times(input.sharesOutstanding);
  return safeRatio(dividendsPaid.abs(), marketCap, {
    asPercent: true,
    denominatorMustBePositive: true,
  });
}
