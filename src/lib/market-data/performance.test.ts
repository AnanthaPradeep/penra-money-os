import { describe, expect, it } from "vitest";

import type { InvestmentActivity } from "@/lib/investments/mapping";
import {
  buildHoldingCashFlows,
  computeAbsoluteReturn,
  computeAnnualizedReturn,
  computeTwr,
  computeXirr,
  MINIMUM_ANNUALIZATION_DAYS,
} from "@/lib/market-data/performance";
import { Decimal } from "@/lib/money/decimal";

function activity(overrides: Partial<InvestmentActivity>): InvestmentActivity {
  return {
    id: "activity-1",
    holdingId: "holding-1",
    activityKind: "buy",
    tradeDate: "2026-01-01",
    settlementDate: null,
    quantity: null,
    unitPrice: null,
    grossAmount: new Decimal(0),
    feeAmount: new Decimal(0),
    taxAmount: new Decimal(0),
    costBasisAmount: null,
    realizedGainAmount: null,
    currency: "INR",
    categoryId: null,
    payeeId: null,
    ledgerTransactionId: null,
    notes: null,
    status: "posted",
    reversalOf: null,
    reversedBy: null,
    ...overrides,
  };
}

describe("computeAbsoluteReturn", () => {
  it("computes gain amount and percent for a simple profit", () => {
    const result = computeAbsoluteReturn(new Decimal(1000), new Decimal(1200));
    expect(result.gainAmount.toString()).toBe("200");
    expect(result.gainPercent?.toString()).toBe("20");
  });

  it("computes a negative gain for a loss", () => {
    const result = computeAbsoluteReturn(new Decimal(1000), new Decimal(800));
    expect(result.gainAmount.toString()).toBe("-200");
    expect(result.gainPercent?.toString()).toBe("-20");
  });

  it("returns a null percent (never a fabricated 0%) when invested cost is zero", () => {
    const result = computeAbsoluteReturn(new Decimal(0), new Decimal(500));
    expect(result.gainAmount.toString()).toBe("500");
    expect(result.gainPercent).toBeNull();
  });
});

describe("computeAnnualizedReturn", () => {
  it("annualizes a two-year 21% cumulative return to 10%", () => {
    const result = computeAnnualizedReturn(
      new Decimal(1000),
      new Decimal(1210),
      730,
    );
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(
        result.annualizedPercent.toDecimalPlaces(4).toNumber(),
      ).toBeCloseTo(10, 2);
    }
  });

  it("refuses to annualize below the documented minimum duration", () => {
    const result = computeAnnualizedReturn(
      new Decimal(1000),
      new Decimal(1050),
      MINIMUM_ANNUALIZATION_DAYS - 1,
    );
    expect(result).toEqual({
      status: "unavailable",
      reason: "below_minimum_duration",
    });
  });

  it("is unavailable, never Infinity/NaN, when invested cost is zero", () => {
    const result = computeAnnualizedReturn(
      new Decimal(0),
      new Decimal(500),
      730,
    );
    expect(result).toEqual({
      status: "unavailable",
      reason: "zero_invested_cost",
    });
  });
});

describe("computeXirr", () => {
  it("solves a simple one-year 10% round trip", () => {
    const result = computeXirr([
      { date: "2025-01-01", amount: new Decimal(-1000) },
      { date: "2026-01-01", amount: new Decimal(1100) },
    ]);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.ratePercent.toNumber()).toBeCloseTo(10, 0);
    }
  });

  it("matches the well-known textbook multi-flow example (~37.34%)", () => {
    const result = computeXirr([
      { date: "2008-01-01", amount: new Decimal(-10000) },
      { date: "2008-03-01", amount: new Decimal(2750) },
      { date: "2008-10-30", amount: new Decimal(4250) },
      { date: "2009-02-15", amount: new Decimal(3250) },
      { date: "2009-04-01", amount: new Decimal(2750) },
    ]);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.ratePercent.toNumber()).toBeCloseTo(37.34, 0);
    }
  });

  it("is unavailable for a single cash flow (a boundary case, not a crash)", () => {
    const result = computeXirr([
      { date: "2025-01-01", amount: new Decimal(-1000) },
    ]);
    expect(result).toEqual({
      status: "unavailable",
      reason: "insufficient_cash_flows",
    });
  });

  it("is unavailable when every flow has the same sign (no rate is defined)", () => {
    const result = computeXirr([
      { date: "2025-01-01", amount: new Decimal(-1000) },
      { date: "2025-06-01", amount: new Decimal(-500) },
    ]);
    expect(result).toEqual({
      status: "unavailable",
      reason: "missing_sign_variation",
    });
  });

  it("never returns NaN or Infinity even for a pathological far-future flow", () => {
    const result = computeXirr([
      { date: "1900-01-01", amount: new Decimal(-100) },
      { date: "2300-01-01", amount: new Decimal(100000) },
    ]);
    if (result.status === "available") {
      expect(Number.isFinite(result.ratePercent.toNumber())).toBe(true);
    } else {
      expect(result.reason).toBe("did_not_converge");
    }
  });

  it("re-validates the solved rate rather than trusting the iteration blindly", () => {
    const result = computeXirr([
      { date: "2020-01-01", amount: new Decimal(-5000) },
      { date: "2021-06-15", amount: new Decimal(-2000) },
      { date: "2023-03-01", amount: new Decimal(9500) },
    ]);
    expect(result.status).toBe("available");
  });
});

describe("computeTwr", () => {
  it("computes a single sub-period return with no external flow", () => {
    const result = computeTwr([
      {
        date: "2026-01-01",
        value: new Decimal(1000),
        externalCashFlow: new Decimal(0),
      },
      {
        date: "2026-02-01",
        value: new Decimal(1100),
        externalCashFlow: new Decimal(0),
      },
    ]);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.twrPercent.toString()).toBe("10");
      expect(result.periodsUsed).toBe(1);
    }
  });

  it("chains sub-periods and neutralizes a contribution's effect on the return", () => {
    const result = computeTwr([
      {
        date: "2026-01-01",
        value: new Decimal(1000),
        externalCashFlow: new Decimal(0),
      },
      {
        date: "2026-02-01",
        value: new Decimal(2200),
        externalCashFlow: new Decimal(1000),
      },
      {
        date: "2026-03-01",
        value: new Decimal(2420),
        externalCashFlow: new Decimal(0),
      },
    ]);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.twrPercent.toDecimalPlaces(4).toString()).toBe("32");
      expect(result.periodsUsed).toBe(2);
    }
  });

  it("reports insufficient data rather than a fabricated return with fewer than two snapshots", () => {
    const result = computeTwr([
      {
        date: "2026-01-01",
        value: new Decimal(1000),
        externalCashFlow: new Decimal(0),
      },
    ]);
    expect(result).toEqual({
      status: "insufficient_data",
      reason: "too_few_snapshots",
    });
  });

  it("skips a zero-valued starting period instead of dividing by zero", () => {
    const result = computeTwr([
      {
        date: "2026-01-01",
        value: new Decimal(0),
        externalCashFlow: new Decimal(0),
      },
      {
        date: "2026-02-01",
        value: new Decimal(0),
        externalCashFlow: new Decimal(0),
      },
    ]);
    expect(result).toEqual({
      status: "insufficient_data",
      reason: "zero_starting_value",
    });
  });
});

describe("buildHoldingCashFlows", () => {
  it("treats a buy as a negative flow of gross + fee + tax", () => {
    const flows = buildHoldingCashFlows(
      [
        activity({
          activityKind: "buy",
          tradeDate: "2025-01-01",
          grossAmount: new Decimal(1000),
          feeAmount: new Decimal(20),
        }),
      ],
      new Decimal(0),
      "2026-01-01",
    );
    expect(flows).toHaveLength(1);
    expect(flows[0]!.amount.toString()).toBe("-1020");
  });

  it("treats a sell as a positive flow net of fee and tax", () => {
    const flows = buildHoldingCashFlows(
      [
        activity({
          activityKind: "sell",
          tradeDate: "2025-06-01",
          grossAmount: new Decimal(1500),
          feeAmount: new Decimal(10),
          taxAmount: new Decimal(5),
        }),
      ],
      new Decimal(0),
      "2026-01-01",
    );
    expect(flows[0]!.amount.toString()).toBe("1485");
  });

  it("excludes adjustment activities (pure corrections, not cash movements)", () => {
    const flows = buildHoldingCashFlows(
      [activity({ activityKind: "adjustment", grossAmount: new Decimal(0) })],
      new Decimal(0),
      "2026-01-01",
    );
    expect(flows).toHaveLength(0);
  });

  it("excludes reversed activities (their reversal already nets to zero)", () => {
    const flows = buildHoldingCashFlows(
      [
        activity({
          activityKind: "buy",
          status: "reversed",
          grossAmount: new Decimal(1000),
        }),
      ],
      new Decimal(0),
      "2026-01-01",
    );
    expect(flows).toHaveLength(0);
  });

  it("appends the current value as a final positive flow on asOfDate", () => {
    const flows = buildHoldingCashFlows(
      [
        activity({
          activityKind: "buy",
          tradeDate: "2025-01-01",
          grossAmount: new Decimal(1000),
        }),
      ],
      new Decimal(1200),
      "2026-01-01",
    );
    expect(flows).toHaveLength(2);
    expect(flows[1]).toEqual({ date: "2026-01-01", amount: new Decimal(1200) });
  });

  it("omits a zero current value rather than appending a fabricated terminal flow", () => {
    const flows = buildHoldingCashFlows(
      [activity({ activityKind: "buy", grossAmount: new Decimal(1000) })],
      new Decimal(0),
      "2026-01-01",
    );
    expect(flows).toHaveLength(1);
  });
});
