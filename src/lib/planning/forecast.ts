import { Decimal, type Money } from "@/lib/money/decimal";

/**
 * A pure, deterministic cash-flow forecast engine — never persisted (no
 * forecast_snapshots table exists; see the header comment in
 * supabase/migrations/20260826113424_phase12_goals_debts_forecast.sql),
 * reproducible from the exact same input every time. The caller (a Server
 * Component) is responsible for querying real balances and candidate
 * cash-flow items — see src/lib/planning/forecast-items.ts — and deciding
 * what counts as a candidate item at all; this module's own responsibility
 * is strictly the arithmetic and scenario filtering, so what must never be
 * included (unposted import rows, unconfigured AI output, assumed
 * investment returns, unverified provider events, IPO/watchlist research,
 * manual valuation changes, transfers) is enforced by never being
 * constructed as a ForecastCashFlowItem in the first place — see that
 * module's own comment for the exhaustive exclusion list.
 */

export const FORECAST_HORIZONS = [
  "30d",
  "3mo",
  "6mo",
  "12mo",
  "custom",
] as const;
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

export const FORECAST_HORIZON_LABELS: Record<ForecastHorizon, string> = {
  "30d": "30 days",
  "3mo": "3 months",
  "6mo": "6 months",
  "12mo": "12 months",
  custom: "Custom range",
};

export const FORECAST_SCENARIOS = [
  "baseline",
  "conservative",
  "custom",
] as const;
export type ForecastScenarioKind = (typeof FORECAST_SCENARIOS)[number];

export const FORECAST_STATUSES = [
  "complete",
  "partial",
  "insufficient_data",
  "stale",
] as const;
export type ForecastStatus = (typeof FORECAST_STATUSES)[number];

export const FORECAST_ITEM_KINDS = [
  "recurring_income",
  "recurring_bill",
  "debt_minimum_payment",
  "goal_contribution",
  "budget_spending",
  "one_time_expense",
  "one_time_income",
  "credit_card_payment_plan",
  "investment_maturity",
] as const;
export type ForecastItemKind = (typeof FORECAST_ITEM_KINDS)[number];

export const FORECAST_ITEM_CONFIDENCES = [
  "confirmed",
  "expected",
  "uncertain",
] as const;
export type ForecastItemConfidence = (typeof FORECAST_ITEM_CONFIDENCES)[number];

/** One candidate cash-flow event within the forecast horizon. amount is signed: positive = inflow, negative = outflow. */
export type ForecastCashFlowItem = {
  id: string;
  kind: ForecastItemKind;
  label: string;
  date: string;
  amount: Money;
  confidence: ForecastItemConfidence;
};

export type ForecastDataCompleteness = {
  hasRecurringItems: boolean;
  hasDebts: boolean;
  hasBudget: boolean;
  hasGoals: boolean;
};

export type ForecastInput = {
  scenario: ForecastScenarioKind;
  horizon: ForecastHorizon;
  /** Required, and only meaningful, when horizon is "custom". Clamped to [1, MAX_HORIZON_DAYS]. */
  customHorizonDays?: number;
  asOf: string;
  /** Hours since the underlying balance/data snapshot was computed — drives the "stale" status. Omit if always-fresh (e.g. computed synchronously from a live query). */
  asOfAgeHours?: number;
  openingBalance: Money;
  items: ForecastCashFlowItem[];
  /** A user-configured safety margin for the conservative scenario — never invented by this engine; 0 if the user hasn't set one. */
  conservativeBufferAmount?: Money;
  dataCompleteness: ForecastDataCompleteness;
};

export type ForecastDailyPoint = {
  date: string;
  balance: Money;
  netChange: Money;
};

export type ForecastResult = {
  scenario: ForecastScenarioKind;
  horizon: ForecastHorizon;
  horizonDays: number;
  asOf: string;
  status: ForecastStatus;
  includedSources: ForecastItemKind[];
  excludedSources: ForecastItemKind[];
  assumptions: string[];
  openingBalance: Money;
  closingBalance: Money;
  lowestBalance: Money;
  lowestBalanceDate: string;
  shortfallDate: string | null;
  unfundedCommitments: Money;
  safeToSpendToday: Money;
  dailySeries: ForecastDailyPoint[];
  includedItemIds: string[];
  excludedItemIds: string[];
};

const MAX_HORIZON_DAYS = 730;
const NEAR_TERM_SAFE_TO_SPEND_DAYS = 7;
const DEFAULT_STALE_THRESHOLD_HOURS = 24;
const ZERO = new Decimal(0);

function resolveHorizonDays(
  horizon: ForecastHorizon,
  customHorizonDays: number | undefined,
): number {
  switch (horizon) {
    case "30d":
      return 30;
    case "3mo":
      return 90;
    case "6mo":
      return 180;
    case "12mo":
      return 365;
    case "custom": {
      const requested = customHorizonDays ?? 30;
      return Math.min(Math.max(Math.trunc(requested), 1), MAX_HORIZON_DAYS);
    }
  }
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Filters candidate items to what a given scenario counts — the only place scenario-specific inclusion/exclusion logic lives. */
function filterItemsForScenario(
  items: ForecastCashFlowItem[],
  scenario: ForecastScenarioKind,
): { included: ForecastCashFlowItem[]; excluded: ForecastCashFlowItem[] } {
  if (scenario === "conservative") {
    return {
      included: items.filter((i) => i.confidence === "confirmed"),
      excluded: items.filter((i) => i.confidence !== "confirmed"),
    };
  }
  if (scenario === "baseline") {
    return {
      included: items.filter((i) => i.confidence !== "uncertain"),
      excluded: items.filter((i) => i.confidence === "uncertain"),
    };
  }
  // custom: the caller has already decided exactly which items to pass in.
  return { included: items, excluded: [] };
}

function resolveStatus(
  input: ForecastInput,
  includedCount: number,
): ForecastStatus {
  if (
    input.asOfAgeHours !== undefined &&
    input.asOfAgeHours > DEFAULT_STALE_THRESHOLD_HOURS
  ) {
    return "stale";
  }
  const { hasRecurringItems, hasDebts, hasBudget, hasGoals } =
    input.dataCompleteness;
  if (includedCount === 0 && !hasRecurringItems && !hasBudget) {
    return "insufficient_data";
  }
  if (!hasRecurringItems || !hasDebts || !hasBudget || !hasGoals) {
    return "partial";
  }
  return "complete";
}

/** Runs one forecast scenario over already-fetched real balances and candidate items — deterministic, reproducible, and free of any database write. */
export function runCashFlowForecast(input: ForecastInput): ForecastResult {
  const horizonDays = resolveHorizonDays(
    input.horizon,
    input.customHorizonDays,
  );
  const { included, excluded } = filterItemsForScenario(
    input.items,
    input.scenario,
  );

  const horizonStart = addDays(input.asOf, 1);
  const horizonEnd = addDays(input.asOf, horizonDays);
  const inRangeIncluded = included.filter(
    (item) => item.date >= horizonStart && item.date <= horizonEnd,
  );

  const netByDate = new Map<string, Money>();
  for (const item of inRangeIncluded) {
    netByDate.set(
      item.date,
      (netByDate.get(item.date) ?? ZERO).plus(item.amount),
    );
  }

  const bufferAmount = input.conservativeBufferAmount ?? ZERO;
  const openingAfterBuffer =
    input.scenario === "conservative"
      ? input.openingBalance.minus(bufferAmount)
      : input.openingBalance;

  const dailySeries: ForecastDailyPoint[] = [
    { date: input.asOf, balance: openingAfterBuffer, netChange: ZERO },
  ];

  let runningBalance = openingAfterBuffer;
  let lowestBalance = openingAfterBuffer;
  let lowestBalanceDate = input.asOf;
  let shortfallDate: string | null = runningBalance.lt(0) ? input.asOf : null;

  for (let offset = 1; offset <= horizonDays; offset += 1) {
    const date = addDays(input.asOf, offset);
    const netChange = netByDate.get(date) ?? ZERO;
    runningBalance = runningBalance.plus(netChange);
    dailySeries.push({ date, balance: runningBalance, netChange });

    if (runningBalance.lt(lowestBalance)) {
      lowestBalance = runningBalance;
      lowestBalanceDate = date;
    }
    if (shortfallDate === null && runningBalance.lt(0)) {
      shortfallDate = date;
    }
  }

  const closingBalance = runningBalance;
  const unfundedCommitments = lowestBalance.lt(0) ? lowestBalance.abs() : ZERO;

  const nearTermOutflows = inRangeIncluded
    .filter((item) => {
      const dayIndex = dailySeries.findIndex((p) => p.date === item.date);
      return (
        item.amount.lt(0) &&
        dayIndex >= 0 &&
        dayIndex <= NEAR_TERM_SAFE_TO_SPEND_DAYS
      );
    })
    .reduce((sum, item) => sum.plus(item.amount.abs()), ZERO);

  const safeToSpendToday = Decimal.max(
    ZERO,
    openingAfterBuffer.minus(nearTermOutflows),
  );

  const includedSources = [
    ...new Set(inRangeIncluded.map((i) => i.kind)),
  ] as ForecastItemKind[];
  const excludedSources = [
    ...new Set(excluded.map((i) => i.kind)),
  ] as ForecastItemKind[];

  const assumptions = [
    "This is a planning estimate from real balances and already-scheduled items — never a guarantee of future income, expenses, or returns.",
    input.scenario === "conservative"
      ? `Conservative scenario: only confirmed items are included, and a ${bufferAmount.toString()} safety buffer you configured is subtracted from the opening balance.`
      : input.scenario === "baseline"
        ? "Baseline scenario: confirmed and expected items are included; uncertain items are excluded."
        : "Custom scenario: exactly the sources you chose are included.",
    `safeToSpendToday accounts only for outflows already scheduled in the next ${NEAR_TERM_SAFE_TO_SPEND_DAYS} days — it is not the same figure as a purpose wallet's safe-to-spend.`,
  ];
  if (
    input.horizon === "custom" &&
    (input.customHorizonDays ?? 0) > MAX_HORIZON_DAYS
  ) {
    assumptions.push(
      `The requested custom horizon was clamped to ${MAX_HORIZON_DAYS} days.`,
    );
  }

  return {
    scenario: input.scenario,
    horizon: input.horizon,
    horizonDays,
    asOf: input.asOf,
    status: resolveStatus(input, inRangeIncluded.length),
    includedSources,
    excludedSources,
    assumptions,
    openingBalance: openingAfterBuffer,
    closingBalance,
    lowestBalance,
    lowestBalanceDate,
    shortfallDate,
    unfundedCommitments,
    safeToSpendToday,
    dailySeries,
    includedItemIds: inRangeIncluded.map((i) => i.id),
    excludedItemIds: excluded.map((i) => i.id),
  };
}
