import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import {
  runCashFlowForecast,
  type ForecastCashFlowItem,
  type ForecastDataCompleteness,
  type ForecastInput,
} from "@/lib/planning/forecast";

const FULL_COMPLETENESS: ForecastDataCompleteness = {
  hasRecurringItems: true,
  hasDebts: true,
  hasBudget: true,
  hasGoals: true,
};

function item(
  overrides: Partial<ForecastCashFlowItem> = {},
): ForecastCashFlowItem {
  return {
    id: "item-1",
    kind: "recurring_bill",
    label: "Rent",
    date: "2026-09-05",
    amount: new Decimal("-1000"),
    confidence: "confirmed",
    ...overrides,
  };
}

function baseInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    scenario: "baseline",
    horizon: "30d",
    asOf: "2026-09-01",
    openingBalance: new Decimal("5000"),
    items: [],
    dataCompleteness: FULL_COMPLETENESS,
    ...overrides,
  };
}

describe("runCashFlowForecast", () => {
  it("resolves each named horizon to the expected number of days", () => {
    expect(runCashFlowForecast(baseInput({ horizon: "30d" })).horizonDays).toBe(
      30,
    );
    expect(runCashFlowForecast(baseInput({ horizon: "3mo" })).horizonDays).toBe(
      90,
    );
    expect(runCashFlowForecast(baseInput({ horizon: "6mo" })).horizonDays).toBe(
      180,
    );
    expect(
      runCashFlowForecast(baseInput({ horizon: "12mo" })).horizonDays,
    ).toBe(365);
  });

  it("clamps a custom horizon to the maximum bound and records the clamp in assumptions", () => {
    const result = runCashFlowForecast(
      baseInput({ horizon: "custom", customHorizonDays: 5000 }),
    );
    expect(result.horizonDays).toBe(730);
    expect(result.assumptions.some((a) => a.includes("clamped"))).toBe(true);
  });

  it("excludes uncertain items under the baseline scenario", () => {
    const result = runCashFlowForecast(
      baseInput({
        scenario: "baseline",
        items: [
          item({
            id: "confirmed",
            confidence: "confirmed",
            amount: new Decimal("-100"),
          }),
          item({
            id: "expected",
            confidence: "expected",
            amount: new Decimal("-100"),
          }),
          item({
            id: "uncertain",
            confidence: "uncertain",
            amount: new Decimal("-1000"),
          }),
        ],
      }),
    );

    expect(result.includedItemIds).toEqual(
      expect.arrayContaining(["confirmed", "expected"]),
    );
    expect(result.includedItemIds).not.toContain("uncertain");
    expect(result.excludedItemIds).toContain("uncertain");
  });

  it("includes only confirmed items under the conservative scenario and subtracts the configured buffer", () => {
    const result = runCashFlowForecast(
      baseInput({
        scenario: "conservative",
        openingBalance: new Decimal("5000"),
        conservativeBufferAmount: new Decimal("500"),
        items: [
          item({
            id: "confirmed",
            confidence: "confirmed",
            amount: new Decimal("-100"),
          }),
          item({
            id: "expected",
            confidence: "expected",
            amount: new Decimal("-100"),
          }),
        ],
      }),
    );

    expect(result.includedItemIds).toEqual(["confirmed"]);
    expect(result.openingBalance.toString()).toBe("4500");
  });

  it("never invents a conservative buffer — defaults to zero when the user hasn't configured one", () => {
    const result = runCashFlowForecast(
      baseInput({
        scenario: "conservative",
        openingBalance: new Decimal("5000"),
      }),
    );
    expect(result.openingBalance.toString()).toBe("5000");
  });

  it("passes every supplied item through unfiltered under the custom scenario", () => {
    const result = runCashFlowForecast(
      baseInput({
        scenario: "custom",
        items: [
          item({ id: "a", confidence: "confirmed" }),
          item({ id: "b", confidence: "uncertain" }),
        ],
      }),
    );
    expect(result.includedItemIds.sort()).toEqual(["a", "b"]);
    expect(result.excludedItemIds).toEqual([]);
  });

  it("nets a same-day inflow/outflow pair (e.g. a transfer) to zero balance change", () => {
    const result = runCashFlowForecast(
      baseInput({
        items: [
          item({ id: "out", date: "2026-09-10", amount: new Decimal("-2000") }),
          item({ id: "in", date: "2026-09-10", amount: new Decimal("2000") }),
        ],
      }),
    );
    const day = result.dailySeries.find((p) => p.date === "2026-09-10")!;
    expect(day.netChange.toString()).toBe("0");
    expect(result.closingBalance.toString()).toBe(
      result.openingBalance.toString(),
    );
  });

  it("excludes an item dated exactly asOf — already reflected in the opening balance", () => {
    const result = runCashFlowForecast(
      baseInput({
        items: [
          item({
            id: "today",
            date: "2026-09-01",
            amount: new Decimal("-500"),
          }),
        ],
      }),
    );
    expect(result.includedItemIds).not.toContain("today");
  });

  it("excludes items outside the horizon window", () => {
    const result = runCashFlowForecast(
      baseInput({
        horizon: "30d",
        items: [
          item({
            id: "far-future",
            date: "2027-01-01",
            amount: new Decimal("-500"),
          }),
        ],
      }),
    );
    expect(result.includedItemIds).not.toContain("far-future");
  });

  it("finds the first shortfall date when the running balance goes negative", () => {
    const result = runCashFlowForecast(
      baseInput({
        openingBalance: new Decimal("1000"),
        items: [
          item({
            id: "big-bill",
            date: "2026-09-10",
            amount: new Decimal("-1500"),
          }),
        ],
      }),
    );
    expect(result.shortfallDate).toBe("2026-09-10");
    expect(result.unfundedCommitments.toString()).toBe("500");
  });

  it("reports no shortfall and zero unfunded commitments when the balance never goes negative", () => {
    const result = runCashFlowForecast(
      baseInput({
        openingBalance: new Decimal("10000"),
        items: [item({ date: "2026-09-10", amount: new Decimal("-500") })],
      }),
    );
    expect(result.shortfallDate).toBeNull();
    expect(result.unfundedCommitments.toString()).toBe("0");
  });

  it("tracks the lowest balance and its date even when the balance recovers afterward", () => {
    const result = runCashFlowForecast(
      baseInput({
        openingBalance: new Decimal("1000"),
        items: [
          item({ id: "dip", date: "2026-09-05", amount: new Decimal("-800") }),
          item({
            id: "recover",
            date: "2026-09-15",
            amount: new Decimal("2000"),
          }),
        ],
      }),
    );
    expect(result.lowestBalanceDate).toBe("2026-09-05");
    expect(result.lowestBalance.toString()).toBe("200");
    expect(result.closingBalance.toString()).toBe("2200");
  });

  it("caps safeToSpendToday at zero and only counts outflows within the near-term window", () => {
    const result = runCashFlowForecast(
      baseInput({
        openingBalance: new Decimal("100"),
        items: [
          item({ id: "near", date: "2026-09-03", amount: new Decimal("-500") }),
          item({ id: "far", date: "2026-09-25", amount: new Decimal("-5000") }),
        ],
      }),
    );
    expect(result.safeToSpendToday.toString()).toBe("0");
    expect(result.safeToSpendToday.isNegative()).toBe(false);
  });

  it("reports status insufficient_data when there are no items and no recurring/budget data", () => {
    const result = runCashFlowForecast(
      baseInput({
        items: [],
        dataCompleteness: {
          hasRecurringItems: false,
          hasDebts: false,
          hasBudget: false,
          hasGoals: false,
        },
      }),
    );
    expect(result.status).toBe("insufficient_data");
  });

  it("reports status partial when some but not all data categories are present", () => {
    const result = runCashFlowForecast(
      baseInput({
        items: [item()],
        dataCompleteness: {
          hasRecurringItems: true,
          hasDebts: false,
          hasBudget: true,
          hasGoals: true,
        },
      }),
    );
    expect(result.status).toBe("partial");
  });

  it("reports status complete when every data category is present", () => {
    const result = runCashFlowForecast(baseInput({ items: [item()] }));
    expect(result.status).toBe("complete");
  });

  it("reports status stale when the snapshot age exceeds the freshness threshold, overriding completeness", () => {
    const result = runCashFlowForecast(
      baseInput({ items: [item()], asOfAgeHours: 48 }),
    );
    expect(result.status).toBe("stale");
  });

  it("is fully reproducible from the same input", () => {
    const input = baseInput({
      items: [
        item({ id: "a" }),
        item({ id: "b", date: "2026-09-20", amount: new Decimal("2000") }),
      ],
    });
    const first = runCashFlowForecast(input);
    const second = runCashFlowForecast(input);
    expect(first.closingBalance.toString()).toBe(
      second.closingBalance.toString(),
    );
    expect(first.dailySeries.length).toBe(second.dailySeries.length);
    expect(first.status).toBe(second.status);
  });

  it("never produces NaN or Infinity across the full daily series", () => {
    const result = runCashFlowForecast(
      baseInput({
        horizon: "12mo",
        items: Array.from({ length: 50 }, (_, i) =>
          item({
            id: `item-${i}`,
            date: `2026-${String((i % 12) + 1).padStart(2, "0")}-10`,
            amount: new Decimal(i % 2 === 0 ? "-333.33" : "250.75"),
          }),
        ),
      }),
    );
    for (const point of result.dailySeries) {
      expect(point.balance.isFinite()).toBe(true);
      expect(point.netChange.isFinite()).toBe(true);
    }
  });

  it("never labels a forecast as a guarantee — assumptions always frame it as an estimate", () => {
    const result = runCashFlowForecast(baseInput());
    expect(
      result.assumptions.some((a) => a.toLowerCase().includes("estimate")),
    ).toBe(true);
  });
});
