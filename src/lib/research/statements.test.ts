import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import type {
  CompanyFinancialMetric,
  CompanyFinancialPeriod,
} from "@/lib/research/mapping";
import {
  buildMetricLookup,
  filterPeriodsByType,
  getLatestPeriod,
  getMetricValue,
  getPriorPeriod,
} from "@/lib/research/statements";

function period(
  id: string,
  periodType: "annual" | "quarterly",
  fiscalPeriodEnd: string,
): CompanyFinancialPeriod {
  return {
    id,
    instrumentId: "instrument-1",
    periodType,
    fiscalPeriodEnd,
    fiscalYear: Number(fiscalPeriodEnd.slice(0, 4)),
    fiscalQuarter: periodType === "quarterly" ? 1 : null,
    reportDate: null,
    currency: "INR",
    statementBasis: "consolidated",
    provider: "twelve_data",
  };
}

function metric(
  periodId: string,
  metricKey: CompanyFinancialMetric["metricKey"],
  value: number,
): CompanyFinancialMetric {
  return {
    id: `${periodId}-${metricKey}`,
    periodId,
    statementType: "income_statement",
    metricKey,
    value: new Decimal(value),
    unitScale: "unit",
    provider: "twelve_data",
  };
}

describe("filterPeriodsByType", () => {
  const periods = [
    period("annual-2023", "annual", "2023-03-31"),
    period("annual-2024", "annual", "2024-03-31"),
    period("q1-2024", "quarterly", "2024-06-30"),
    period("q2-2024", "quarterly", "2024-09-30"),
  ];

  it("never mixes annual and quarterly periods in one result", () => {
    const annual = filterPeriodsByType(periods, "annual");
    expect(annual.every((p) => p.periodType === "annual")).toBe(true);
    expect(annual).toHaveLength(2);

    const quarterly = filterPeriodsByType(periods, "quarterly");
    expect(quarterly.every((p) => p.periodType === "quarterly")).toBe(true);
    expect(quarterly).toHaveLength(2);
  });

  it("orders most-recent fiscal-period-end first", () => {
    const annual = filterPeriodsByType(periods, "annual");
    expect(annual.map((p) => p.id)).toEqual(["annual-2024", "annual-2023"]);
  });
});

describe("getLatestPeriod", () => {
  const periods = [
    period("annual-2023", "annual", "2023-03-31"),
    period("annual-2024", "annual", "2024-03-31"),
  ];

  it("returns the most recent period of the requested type", () => {
    expect(getLatestPeriod(periods, "annual")?.id).toBe("annual-2024");
  });

  it("returns null when no period of that type exists", () => {
    expect(getLatestPeriod(periods, "quarterly")).toBeNull();
  });
});

describe("getPriorPeriod", () => {
  const periods = [
    period("annual-2022", "annual", "2022-03-31"),
    period("annual-2023", "annual", "2023-03-31"),
    period("annual-2024", "annual", "2024-03-31"),
    period("q1-2024", "quarterly", "2024-06-30"),
  ];

  it("finds the immediately preceding period of the same type", () => {
    const current = periods.find((p) => p.id === "annual-2024")!;
    expect(getPriorPeriod(periods, current)?.id).toBe("annual-2023");
  });

  it("never returns a period of a different type as the prior period", () => {
    const current = periods.find((p) => p.id === "q1-2024")!;
    expect(getPriorPeriod(periods, current)).toBeNull();
  });

  it("returns null for the earliest period of its type", () => {
    const earliest = periods.find((p) => p.id === "annual-2022")!;
    expect(getPriorPeriod(periods, earliest)).toBeNull();
  });
});

describe("buildMetricLookup / getMetricValue", () => {
  it("looks up a metric by period and key", () => {
    const lookup = buildMetricLookup([
      metric("period-1", "revenue", 1000),
      metric("period-1", "net_income", 100),
      metric("period-2", "revenue", 2000),
    ]);

    expect(getMetricValue(lookup, "period-1", "revenue")?.toString()).toBe(
      "1000",
    );
    expect(getMetricValue(lookup, "period-2", "revenue")?.toString()).toBe(
      "2000",
    );
  });

  it("returns null (never a fabricated zero) for a metric never reported in that period", () => {
    const lookup = buildMetricLookup([metric("period-1", "revenue", 1000)]);
    expect(getMetricValue(lookup, "period-1", "net_income")).toBeNull();
    expect(getMetricValue(lookup, "unknown-period", "revenue")).toBeNull();
  });
});
