import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import {
  comparePayoffStrategies,
  runPayoffScenario,
  type PayoffDebtInput,
} from "@/lib/planning/payoff";

function debt(overrides: Partial<PayoffDebtInput> = {}): PayoffDebtInput {
  return {
    id: "debt-1",
    name: "Debt 1",
    currentPrincipal: new Decimal("10000"),
    annualInterestRate: new Decimal("12"),
    minimumPayment: new Decimal("500"),
    ...overrides,
  };
}

describe("runPayoffScenario", () => {
  it("pays off a single zero-interest debt in exactly balance/minimumPayment months", () => {
    const result = runPayoffScenario({
      strategy: "minimum_payment",
      debts: [
        debt({
          currentPrincipal: new Decimal("1000"),
          annualInterestRate: new Decimal("0"),
          minimumPayment: new Decimal("200"),
        }),
      ],
      extraMonthlyPayment: new Decimal("0"),
    });

    expect(result.totalMonths).toBe(5);
    expect(result.totalInterestPaid.toString()).toBe("0");
    expect(result.debts[0]!.monthsToPayoff).toBe(5);
    expect(result.insufficientPayment).toBe(false);
  });

  it("charges interest before applying the payment, leaving a small remainder when the payment equals the original principal", () => {
    const result = runPayoffScenario({
      strategy: "minimum_payment",
      debts: [
        debt({
          currentPrincipal: new Decimal("1000"),
          annualInterestRate: new Decimal("12"),
          minimumPayment: new Decimal("1000"),
        }),
      ],
      extraMonthlyPayment: new Decimal("0"),
    });

    // Monthly rate = 12/100/12 = 0.01, interest = 1000 * 0.01 = 10, so a
    // 1000 payment against a 1010 balance-with-interest leaves 10
    // outstanding, paid off (plus its own 0.10 interest) the next month.
    expect(result.schedule[0]!.interestAccrued.toString()).toBe("10");
    expect(result.schedule[0]!.closingBalance.toString()).toBe("10");
    expect(result.totalMonths).toBe(2);
    expect(result.totalInterestPaid.toString()).toBe("10.1");
  });

  it("flags negative amortization when the minimum payment doesn't cover accrued interest", () => {
    const result = runPayoffScenario({
      strategy: "minimum_payment",
      debts: [
        debt({
          id: "d1",
          currentPrincipal: new Decimal("100000"),
          annualInterestRate: new Decimal("24"),
          minimumPayment: new Decimal("100"),
        }),
      ],
      extraMonthlyPayment: new Decimal("0"),
      maxMonths: 12,
    });

    expect(result.negativeAmortizationDebtIds).toContain("d1");
    expect(result.insufficientPayment).toBe(true);
    expect(result.totalMonths).toBeNull();
    expect(result.debts[0]!.monthsToPayoff).toBeNull();
  });

  it("never produces NaN or Infinity even under negative amortization over many months", () => {
    const result = runPayoffScenario({
      strategy: "minimum_payment",
      debts: [
        debt({
          currentPrincipal: new Decimal("50000"),
          annualInterestRate: new Decimal("36"),
          minimumPayment: new Decimal("10"),
        }),
      ],
      extraMonthlyPayment: new Decimal("0"),
      maxMonths: 60,
    });

    for (const entry of result.schedule) {
      expect(entry.closingBalance.isFinite()).toBe(true);
      expect(entry.interestAccrued.isFinite()).toBe(true);
    }
    expect(result.totalInterestPaid.isFinite()).toBe(true);
  });

  it("ignores extraMonthlyPayment entirely under the minimum_payment strategy", () => {
    const result = runPayoffScenario({
      strategy: "minimum_payment",
      debts: [
        debt({
          currentPrincipal: new Decimal("1000"),
          annualInterestRate: new Decimal("0"),
          minimumPayment: new Decimal("100"),
        }),
      ],
      extraMonthlyPayment: new Decimal("500"),
    });

    expect(result.totalMonths).toBe(10);
  });

  it("orders snowball by ascending current balance", () => {
    const result = runPayoffScenario({
      strategy: "snowball",
      debts: [
        debt({
          id: "big",
          currentPrincipal: new Decimal("5000"),
          minimumPayment: new Decimal("100"),
        }),
        debt({
          id: "small",
          currentPrincipal: new Decimal("500"),
          minimumPayment: new Decimal("50"),
        }),
        debt({
          id: "mid",
          currentPrincipal: new Decimal("2000"),
          minimumPayment: new Decimal("75"),
        }),
      ],
      extraMonthlyPayment: new Decimal("200"),
    });

    expect(result.payoffOrder).toEqual(["small", "mid", "big"]);
  });

  it("orders avalanche by descending interest rate", () => {
    const result = runPayoffScenario({
      strategy: "avalanche",
      debts: [
        debt({
          id: "low",
          annualInterestRate: new Decimal("8"),
          currentPrincipal: new Decimal("1000"),
        }),
        debt({
          id: "high",
          annualInterestRate: new Decimal("28"),
          currentPrincipal: new Decimal("1000"),
        }),
        debt({
          id: "mid",
          annualInterestRate: new Decimal("15"),
          currentPrincipal: new Decimal("1000"),
        }),
      ],
      extraMonthlyPayment: new Decimal("200"),
    });

    expect(result.payoffOrder).toEqual(["high", "mid", "low"]);
  });

  it("respects a custom order and appends any debt missing from it", () => {
    const result = runPayoffScenario({
      strategy: "custom_order",
      debts: [debt({ id: "a" }), debt({ id: "b" }), debt({ id: "c" })],
      extraMonthlyPayment: new Decimal("100"),
      customOrder: ["c", "a"],
    });

    expect(result.payoffOrder).toEqual(["c", "a", "b"]);
  });

  it("rolls a paid-off debt's minimum payment into the extra pool for the next debt (waterfall)", () => {
    const result = runPayoffScenario({
      strategy: "snowball",
      debts: [
        debt({
          id: "small",
          currentPrincipal: new Decimal("100"),
          annualInterestRate: new Decimal("0"),
          minimumPayment: new Decimal("50"),
        }),
        debt({
          id: "large",
          currentPrincipal: new Decimal("10000"),
          annualInterestRate: new Decimal("0"),
          minimumPayment: new Decimal("100"),
        }),
      ],
      extraMonthlyPayment: new Decimal("0"),
    });

    // "small" is paid off in month 2 (100 balance / 50 minimum). From
    // month 3 onward, its freed 50/month minimum joins "large"'s own 100
    // minimum, so "large" pays down faster than 10000/100 = 100 months.
    expect(result.debts.find((d) => d.debtId === "small")!.monthsToPayoff).toBe(
      2,
    );
    const largeMonths = result.debts.find(
      (d) => d.debtId === "large",
    )!.monthsToPayoff;
    expect(largeMonths).not.toBeNull();
    expect(largeMonths!).toBeLessThan(100);
  });

  it("never labels a strategy as best — orderingExplanation is purely descriptive", () => {
    const result = runPayoffScenario({
      strategy: "avalanche",
      debts: [debt()],
      extraMonthlyPayment: new Decimal("0"),
    });

    expect(result.orderingExplanation.toLowerCase()).not.toContain("best");
  });
});

describe("comparePayoffStrategies", () => {
  it("returns minimum_payment, snowball, and avalanche by default", () => {
    const results = comparePayoffStrategies(
      [
        debt({ id: "a" }),
        debt({ id: "b", currentPrincipal: new Decimal("2000") }),
      ],
      new Decimal("200"),
    );

    expect(results.map((r) => r.strategy)).toEqual([
      "minimum_payment",
      "snowball",
      "avalanche",
    ]);
  });

  it("includes custom_order when a customOrder is supplied", () => {
    const results = comparePayoffStrategies(
      [debt({ id: "a" }), debt({ id: "b" })],
      new Decimal("200"),
      { customOrder: ["b", "a"] },
    );

    expect(results.map((r) => r.strategy)).toContain("custom_order");
    const custom = results.find((r) => r.strategy === "custom_order")!;
    expect(custom.payoffOrder).toEqual(["b", "a"]);
  });

  it("keeps each strategy's simulation independent (no shared mutable state between runs)", () => {
    const debts = [
      debt({
        id: "a",
        currentPrincipal: new Decimal("500"),
        minimumPayment: new Decimal("100"),
      }),
      debt({
        id: "b",
        currentPrincipal: new Decimal("5000"),
        minimumPayment: new Decimal("100"),
      }),
    ];

    const results = comparePayoffStrategies(debts, new Decimal("300"));
    const snowball = results.find((r) => r.strategy === "snowball")!;
    const avalanche = results.find((r) => r.strategy === "avalanche")!;

    // Re-running should be perfectly reproducible — same inputs, same outputs.
    const rerun = comparePayoffStrategies(debts, new Decimal("300"));
    const snowballRerun = rerun.find((r) => r.strategy === "snowball")!;
    expect(snowballRerun.totalMonths).toBe(snowball.totalMonths);
    expect(avalanche.totalMonths).not.toBeNull();
  });
});
