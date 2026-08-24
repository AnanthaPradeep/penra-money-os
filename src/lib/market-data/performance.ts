import type { InvestmentActivity } from "@/lib/investments/mapping";
import { Decimal, type Money } from "@/lib/money/decimal";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

/** A single dated external cash flow into/out of a holding or portfolio — a purchase/contribution is negative (money leaving the investor), a sale/withdrawal/terminal value is positive (money returning to the investor). */
export type DatedCashFlow = {
  date: string;
  amount: Money;
};

export type AbsoluteReturn = {
  gainAmount: Money;
  /** null when investedCost is zero — a percentage return is undefined, never fabricated as 0%. */
  gainPercent: Decimal | null;
};

/** Simple point-to-point return: (current - invested) and, when invested is nonzero, that gain as a percentage of invested cost. Never annualized. */
export function computeAbsoluteReturn(
  investedCost: Money,
  currentValue: Money,
): AbsoluteReturn {
  const gainAmount = currentValue.minus(investedCost);
  if (investedCost.isZero()) {
    return { gainAmount, gainPercent: null };
  }
  return {
    gainAmount,
    gainPercent: gainAmount.dividedBy(investedCost).times(100),
  };
}

/** Below this many elapsed days, annualizing a return is too statistically unstable to present — a short-lived holding's return is shown only as an absolute figure. */
export const MINIMUM_ANNUALIZATION_DAYS = 365;

export type AnnualizedReturn =
  | { status: "available"; annualizedPercent: Decimal }
  | {
      status: "unavailable";
      reason: "below_minimum_duration" | "zero_invested_cost";
    };

/**
 * CAGR-style annualized return: ((current / invested) ^ (365 / days)) - 1.
 * The fractional exponent is the one place this function drops out of exact
 * Decimal arithmetic into native `number` — deliberately, and only for the
 * exponentiation itself; `investedCost`/`currentValue` stay exact Decimal
 * values right up to that boundary, and the result is converted back to a
 * Decimal immediately after.
 */
export function computeAnnualizedReturn(
  investedCost: Money,
  currentValue: Money,
  elapsedDays: number,
): AnnualizedReturn {
  if (investedCost.isZero() || investedCost.isNegative()) {
    return { status: "unavailable", reason: "zero_invested_cost" };
  }
  if (elapsedDays < MINIMUM_ANNUALIZATION_DAYS) {
    return { status: "unavailable", reason: "below_minimum_duration" };
  }

  const ratio = currentValue.dividedBy(investedCost).toNumber();
  const years = elapsedDays / DAYS_PER_YEAR;
  const annualizedRatio = Math.pow(ratio, 1 / years);

  if (!Number.isFinite(annualizedRatio)) {
    return { status: "unavailable", reason: "zero_invested_cost" };
  }

  return {
    status: "available",
    annualizedPercent: new Decimal(annualizedRatio).minus(1).times(100),
  };
}

export type XirrResult =
  | { status: "available"; ratePercent: Decimal }
  | {
      status: "unavailable";
      reason:
        | "insufficient_cash_flows"
        | "missing_sign_variation"
        | "did_not_converge";
    };

function daysBetween(start: string, end: string): number {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() -
      new Date(`${start}T00:00:00Z`).getTime()) /
      MILLISECONDS_PER_DAY,
  );
}

/** NPV of a set of {t: years, amount: number} flows at a given annual rate — pure native-number evaluation, the deliberate root-solving boundary described on computeXirr. */
function npv(rate: number, flows: { t: number; amount: number }[]): number {
  let total = 0;
  for (const flow of flows) {
    total += flow.amount / Math.pow(1 + rate, flow.t);
  }
  return total;
}

function npvDerivative(
  rate: number,
  flows: { t: number; amount: number }[],
): number {
  let total = 0;
  for (const flow of flows) {
    if (flow.t === 0) {
      continue;
    }
    total += (-flow.t * flow.amount) / Math.pow(1 + rate, flow.t + 1);
  }
  return total;
}

const XIRR_MAX_NEWTON_ITERATIONS = 100;
const XIRR_TOLERANCE = 1e-7;
const XIRR_BISECTION_LOW = -0.9999;
const XIRR_BISECTION_HIGH = 100;
const XIRR_MAX_BISECTION_ITERATIONS = 200;

/**
 * Money-weighted return (XIRR) via Newton-Raphson with a bounded-bisection
 * fallback. Requires at least one negative flow (money invested) and one
 * positive flow (money returned or the terminal value) — a set of same-sign
 * flows has no defined rate and is rejected before any solving is attempted.
 * Never returns NaN/Infinity: any non-convergence maps to a safe
 * "unavailable" result with a reason, never a guessed number. The found
 * rate is always re-validated by re-evaluating NPV at it before being
 * accepted, so a spurious root from floating-point noise cannot slip
 * through undetected.
 */
export function computeXirr(cashFlows: readonly DatedCashFlow[]): XirrResult {
  if (cashFlows.length < 2) {
    return { status: "unavailable", reason: "insufficient_cash_flows" };
  }

  const sorted = [...cashFlows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const hasPositive = sorted.some((f) => f.amount.isPositive());
  const hasNegative = sorted.some((f) => f.amount.isNegative());
  if (!hasPositive || !hasNegative) {
    return { status: "unavailable", reason: "missing_sign_variation" };
  }

  const baseDate = sorted[0]!.date;
  const flows = sorted.map((f) => ({
    t: daysBetween(baseDate, f.date) / DAYS_PER_YEAR,
    amount: f.amount.toNumber(),
  }));

  let rate = 0.1;
  let converged = false;
  for (let i = 0; i < XIRR_MAX_NEWTON_ITERATIONS; i++) {
    const value = npv(rate, flows);
    const derivative = npvDerivative(rate, flows);
    if (!Number.isFinite(value) || !Number.isFinite(derivative)) {
      break;
    }
    if (Math.abs(value) < XIRR_TOLERANCE) {
      converged = true;
      break;
    }
    if (derivative === 0) {
      break;
    }
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= XIRR_BISECTION_LOW) {
      break;
    }
    rate = next;
  }

  if (!converged || !Number.isFinite(rate)) {
    const bisected = bisectXirr(flows);
    if (bisected === null) {
      return { status: "unavailable", reason: "did_not_converge" };
    }
    rate = bisected;
  }

  const finalNpv = npv(rate, flows);
  if (!Number.isFinite(rate) || Math.abs(finalNpv) > 1e-2) {
    return { status: "unavailable", reason: "did_not_converge" };
  }

  return { status: "available", ratePercent: new Decimal(rate).times(100) };
}

function bisectXirr(flows: { t: number; amount: number }[]): number | null {
  let low = XIRR_BISECTION_LOW;
  let high = XIRR_BISECTION_HIGH;
  let npvLow = npv(low, flows);
  let npvHigh = npv(high, flows);

  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh)) {
    return null;
  }
  if (npvLow === 0) {
    return low;
  }
  if (npvHigh === 0) {
    return high;
  }
  if (Math.sign(npvLow) === Math.sign(npvHigh)) {
    return null;
  }

  for (let i = 0; i < XIRR_MAX_BISECTION_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid, flows);
    if (!Number.isFinite(npvMid)) {
      return null;
    }
    if (Math.abs(npvMid) < XIRR_TOLERANCE) {
      return mid;
    }
    if (Math.sign(npvMid) === Math.sign(npvLow)) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
      npvHigh = npvMid;
    }
  }
  return (low + high) / 2;
}

/** One valuation snapshot on a given date, used to build TWR sub-periods. */
export type TwrSnapshot = {
  date: string;
  value: Money;
  /** Net external cash flow (contributions positive, withdrawals negative) that occurred on this date, already reflected in `value`. */
  externalCashFlow: Money;
};

export type TwrResult =
  | { status: "available"; twrPercent: Decimal; periodsUsed: number }
  | {
      status: "insufficient_data";
      reason: "too_few_snapshots" | "zero_starting_value";
    };

const MINIMUM_TWR_SNAPSHOTS = 2;

/**
 * Time-weighted return by chaining daily sub-period returns from stored
 * portfolio-value snapshots — never computed across a gap the snapshots
 * don't actually cover. Entirely exact-Decimal arithmetic: no native
 * `number` conversion anywhere, since every operation here is
 * multiplication/division of money-derived Decimals, not a fractional
 * exponent.
 */
export function computeTwr(snapshots: readonly TwrSnapshot[]): TwrResult {
  if (snapshots.length < MINIMUM_TWR_SNAPSHOTS) {
    return { status: "insufficient_data", reason: "too_few_snapshots" };
  }

  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : 1));

  let cumulative = new Decimal(1);
  let periodsUsed = 0;
  for (let i = 1; i < sorted.length; i++) {
    const start = sorted[i - 1]!;
    const end = sorted[i]!;
    if (start.value.isZero() || start.value.isNegative()) {
      continue;
    }
    const periodReturn = end.value
      .minus(end.externalCashFlow)
      .minus(start.value)
      .dividedBy(start.value);
    cumulative = cumulative.times(new Decimal(1).plus(periodReturn));
    periodsUsed += 1;
  }

  if (periodsUsed === 0) {
    return { status: "insufficient_data", reason: "zero_starting_value" };
  }

  return {
    status: "available",
    twrPercent: cumulative.minus(1).times(100),
    periodsUsed,
  };
}

/**
 * Turns a holding's posted activities plus its current valuation into the
 * dated external cash-flow series computeXirr expects — money leaving the
 * investor (buy/contribution/fee) is negative, money returning
 * (sell/withdrawal/dividend/interest) is positive, and the current value is
 * appended as a final positive flow on `asOfDate` (the standard
 * treat-as-if-liquidated-today convention for a money-weighted return on an
 * open position). `adjustment` activities are pure corrections, never real
 * cash movements, and are excluded. Only `posted` activities are used —
 * `reversed` originals and their reversal rows always sum to zero by
 * construction (see investment_holding_position in the Phase 7 migration),
 * so including both would just add non-cancelling floating noise for no
 * benefit.
 */
export function buildHoldingCashFlows(
  activities: readonly InvestmentActivity[],
  currentValue: Money,
  asOfDate: string,
): DatedCashFlow[] {
  const flows: DatedCashFlow[] = [];

  for (const activity of activities) {
    if (activity.status !== "posted") {
      continue;
    }
    switch (activity.activityKind) {
      case "buy":
      case "contribution":
      case "fee":
        flows.push({
          date: activity.tradeDate,
          amount: activity.grossAmount
            .plus(activity.feeAmount)
            .plus(activity.taxAmount)
            .negated(),
        });
        break;
      case "sell":
      case "withdrawal":
      case "dividend":
      case "interest":
        flows.push({
          date: activity.tradeDate,
          amount: activity.grossAmount
            .minus(activity.feeAmount)
            .minus(activity.taxAmount),
        });
        break;
      case "adjustment":
        break;
    }
  }

  if (currentValue.greaterThan(0)) {
    flows.push({ date: asOfDate, amount: currentValue });
  }

  return flows;
}
