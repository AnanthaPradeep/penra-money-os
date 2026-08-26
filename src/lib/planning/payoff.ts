import { Decimal, type Money } from "@/lib/money/decimal";

/**
 * A pure, deterministic debt-payoff simulator — never persisted, never
 * posts a transaction, never changes a debt's stored terms (see the
 * module header in supabase/migrations/20260826113424_phase12_goals_
 * debts_forecast.sql for why no debt_scenarios table exists at all: a
 * scenario has nothing in the database to write to). Every function here
 * takes plain already-fetched values and returns a plain result — the
 * caller (a Server Component) is responsible for reading debts/current
 * principal from the database and rendering the result, exactly like
 * src/lib/bank-import/matching.ts's pure-function convention.
 *
 * Simplifying assumption, stated explicitly rather than hidden: interest
 * is accrued monthly as annualInterestRate/12 regardless of a debt's own
 * payment_frequency — a standard simplification for a payoff comparison
 * tool, and the same annualInterestRate the user already entered (this
 * never invents a rate). Every result carries `assumptions` so the UI can
 * surface this rather than imply bank-exact precision.
 */

export const PAYOFF_STRATEGIES = [
  "minimum_payment",
  "snowball",
  "avalanche",
  "custom_order",
] as const;
export type PayoffStrategyKind = (typeof PAYOFF_STRATEGIES)[number];

export const PAYOFF_STRATEGY_LABELS: Record<PayoffStrategyKind, string> = {
  minimum_payment: "Minimum payments only",
  snowball: "Snowball (smallest balance first)",
  avalanche: "Avalanche (highest rate first)",
  custom_order: "Custom order",
};

export type PayoffDebtInput = {
  id: string;
  name: string;
  currentPrincipal: Money;
  annualInterestRate: Money;
  minimumPayment: Money;
};

export type PayoffScenarioInput = {
  strategy: PayoffStrategyKind;
  debts: PayoffDebtInput[];
  extraMonthlyPayment: Money;
  /** Required, and only meaningful, for strategy "custom_order" — every debt id, in the user's chosen priority order. */
  customOrder?: string[];
  /** Safety bound on the simulation, never unbounded — default 360 months (30 years). */
  maxMonths?: number;
};

export type PayoffMonthEntry = {
  month: number;
  debtId: string;
  openingBalance: Money;
  interestAccrued: Money;
  paymentApplied: Money;
  principalApplied: Money;
  closingBalance: Money;
};

export type PayoffDebtResult = {
  debtId: string;
  name: string;
  /** null when the debt is not paid off within maxMonths — never fabricated as a guessed date. */
  monthsToPayoff: number | null;
  totalInterestPaid: Money;
  totalPaid: Money;
};

export type PayoffScenarioResult = {
  strategy: PayoffStrategyKind;
  payoffOrder: string[];
  orderingExplanation: string;
  debts: PayoffDebtResult[];
  /** null when at least one debt never reaches zero within maxMonths. */
  totalMonths: number | null;
  totalInterestPaid: Money;
  totalPaid: Money;
  insufficientPayment: boolean;
  /** Debts whose minimum payment doesn't cover the interest accruing that month at least once — shown, never hidden. */
  negativeAmortizationDebtIds: string[];
  schedule: PayoffMonthEntry[];
  assumptions: string[];
};

const DEFAULT_MAX_MONTHS = 360;
const ZERO = new Decimal(0);

function monthlyRate(annualInterestRate: Money): Money {
  return annualInterestRate.dividedBy(100).dividedBy(12);
}

function orderDebts(
  debts: PayoffDebtInput[],
  strategy: PayoffStrategyKind,
  customOrder: string[] | undefined,
): { order: PayoffDebtInput[]; explanation: string } {
  if (strategy === "minimum_payment") {
    return {
      order: [...debts],
      explanation:
        "No extra payment is prioritized — every debt receives only its minimum payment each month.",
    };
  }
  if (strategy === "snowball") {
    const order = [...debts].sort((a, b) =>
      a.currentPrincipal.comparedTo(b.currentPrincipal),
    );
    return {
      order,
      explanation:
        "Extra payment goes to the smallest remaining balance first, then rolls to the next-smallest once each debt is paid off — prioritizes quick wins over minimizing total interest.",
    };
  }
  if (strategy === "avalanche") {
    const order = [...debts].sort((a, b) =>
      b.annualInterestRate.comparedTo(a.annualInterestRate),
    );
    return {
      order,
      explanation:
        "Extra payment goes to the highest interest rate first, then rolls to the next-highest — minimizes total interest paid, though the first payoff may take longer than snowball's.",
    };
  }
  // custom_order
  const idOrder = customOrder ?? [];
  const byId = new Map(debts.map((d) => [d.id, d]));
  const order = idOrder
    .map((id) => byId.get(id))
    .filter((d): d is PayoffDebtInput => d !== undefined);
  const missing = debts.filter((d) => !idOrder.includes(d.id));
  return {
    order: [...order, ...missing],
    explanation:
      "Extra payment follows the order you chose, then rolls to the next debt in that order once each is paid off.",
  };
}

/** Runs one payoff scenario to completion (or to the maxMonths safety bound) and returns a full, explainable result. */
export function runPayoffScenario(
  input: PayoffScenarioInput,
): PayoffScenarioResult {
  const maxMonths = input.maxMonths ?? DEFAULT_MAX_MONTHS;
  const { order, explanation } = orderDebts(
    input.debts,
    input.strategy,
    input.customOrder,
  );

  const balances = new Map<string, Money>(
    order.map((d) => [d.id, d.currentPrincipal]),
  );
  const totalInterestByDebt = new Map<string, Money>(
    order.map((d) => [d.id, ZERO]),
  );
  const totalPaidByDebt = new Map<string, Money>(
    order.map((d) => [d.id, ZERO]),
  );
  const monthsToPayoff = new Map<string, number | null>(
    order.map((d) => [d.id, null]),
  );
  const negativeAmortizationDebtIds = new Set<string>();
  const schedule: PayoffMonthEntry[] = [];

  const applyExtra = input.strategy !== "minimum_payment";
  let month = 0;
  let allPaidOffAtMonth: number | null = null;
  // Minimum payments of debts already paid off roll forward permanently
  // into the pool of "extra" money available every subsequent month —
  // the defining behaviour of both snowball and avalanche.
  let freedMinimumsPool = ZERO;

  while (month < maxMonths) {
    const stillOwing = order.filter((d) => balances.get(d.id)!.gt(0));
    if (stillOwing.length === 0) {
      allPaidOffAtMonth = month;
      break;
    }
    month += 1;

    const thisMonthEntryByDebtId = new Map<string, PayoffMonthEntry>();

    for (const debt of order) {
      const opening = balances.get(debt.id)!;
      if (opening.lte(0)) {
        continue;
      }

      const interest = opening.times(monthlyRate(debt.annualInterestRate));
      const balanceWithInterest = opening.plus(interest);

      if (debt.minimumPayment.lt(interest)) {
        negativeAmortizationDebtIds.add(debt.id);
      }

      const minimumApplied = Decimal.min(
        debt.minimumPayment,
        balanceWithInterest,
      );
      const closing = balanceWithInterest.minus(minimumApplied);
      const principalApplied = minimumApplied.minus(interest);

      totalInterestByDebt.set(
        debt.id,
        totalInterestByDebt.get(debt.id)!.plus(interest),
      );
      totalPaidByDebt.set(
        debt.id,
        totalPaidByDebt.get(debt.id)!.plus(minimumApplied),
      );

      const entry: PayoffMonthEntry = {
        month,
        debtId: debt.id,
        openingBalance: opening,
        interestAccrued: interest,
        paymentApplied: minimumApplied,
        principalApplied: principalApplied.gt(0) ? principalApplied : ZERO,
        closingBalance: closing,
      };
      schedule.push(entry);
      thisMonthEntryByDebtId.set(debt.id, entry);

      balances.set(debt.id, closing);

      if (closing.lte(0) && monthsToPayoff.get(debt.id) === null) {
        monthsToPayoff.set(debt.id, month);
        freedMinimumsPool = freedMinimumsPool.plus(debt.minimumPayment);
      }
    }

    if (applyExtra) {
      let availableExtra = input.extraMonthlyPayment.plus(freedMinimumsPool);

      for (const debt of order) {
        if (availableExtra.lte(0)) {
          break;
        }
        const remaining = balances.get(debt.id)!;
        if (remaining.lte(0)) {
          continue;
        }
        const extraApplied = Decimal.min(availableExtra, remaining);
        const newClosing = remaining.minus(extraApplied);
        balances.set(debt.id, newClosing);
        availableExtra = availableExtra.minus(extraApplied);
        totalPaidByDebt.set(
          debt.id,
          totalPaidByDebt.get(debt.id)!.plus(extraApplied),
        );

        const entry = thisMonthEntryByDebtId.get(debt.id);
        if (entry) {
          entry.paymentApplied = entry.paymentApplied.plus(extraApplied);
          entry.principalApplied = entry.principalApplied.plus(extraApplied);
          entry.closingBalance = newClosing;
        }

        if (newClosing.lte(0) && monthsToPayoff.get(debt.id) === null) {
          monthsToPayoff.set(debt.id, month);
          freedMinimumsPool = freedMinimumsPool.plus(debt.minimumPayment);
        }
      }
    }
  }

  const stillOutstanding = order.filter((d) => balances.get(d.id)!.gt(0));
  const totalMonths =
    stillOutstanding.length === 0 ? (allPaidOffAtMonth ?? month) : null;

  const debtResults: PayoffDebtResult[] = order.map((d) => ({
    debtId: d.id,
    name: d.name,
    monthsToPayoff: monthsToPayoff.get(d.id) ?? null,
    totalInterestPaid: totalInterestByDebt.get(d.id)!,
    totalPaid: totalPaidByDebt.get(d.id)!,
  }));

  const totalInterestPaid = debtResults.reduce(
    (sum, d) => sum.plus(d.totalInterestPaid),
    ZERO,
  );
  const totalPaid = debtResults.reduce((sum, d) => sum.plus(d.totalPaid), ZERO);

  const assumptions = [
    "Interest accrues monthly at annualInterestRate ÷ 12, regardless of each debt's own payment frequency.",
    "A minimum payment that doesn't cover a month's accrued interest is shown as negative amortization, never hidden or auto-corrected.",
    `This simulation stops after ${maxMonths} months even if a debt is not yet paid off.`,
  ];

  return {
    strategy: input.strategy,
    payoffOrder: order.map((d) => d.id),
    orderingExplanation: explanation,
    debts: debtResults,
    totalMonths,
    totalInterestPaid,
    totalPaid,
    insufficientPayment: totalMonths === null,
    negativeAmortizationDebtIds: [...negativeAmortizationDebtIds],
    schedule,
    assumptions,
  };
}

/**
 * Runs every requested strategy over the same debts/extra payment and
 * returns them side by side — never labels one "best": comparison is the
 * UI's job, this only computes the numbers. customOrder is required to
 * include "custom_order" in `strategies`.
 */
export function comparePayoffStrategies(
  debts: PayoffDebtInput[],
  extraMonthlyPayment: Money,
  options: {
    strategies?: PayoffStrategyKind[];
    customOrder?: string[];
    maxMonths?: number;
  } = {},
): PayoffScenarioResult[] {
  const strategies =
    options.strategies ??
    (options.customOrder
      ? PAYOFF_STRATEGIES
      : (["minimum_payment", "snowball", "avalanche"] as const));

  return strategies.map((strategy) =>
    runPayoffScenario({
      strategy,
      debts,
      extraMonthlyPayment,
      ...(options.customOrder ? { customOrder: options.customOrder } : {}),
      ...(options.maxMonths !== undefined
        ? { maxMonths: options.maxMonths }
        : {}),
    }),
  );
}
