import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import type { CompanyFinancialMetric } from "@/lib/research/mapping";
import { buildMetricLookup } from "@/lib/research/statements";

import { CompanyRatiosPanel } from "@/components/research/CompanyRatiosPanel";

function metric(
  periodId: string,
  metricKey: CompanyFinancialMetric["metricKey"],
  value: number,
  statementType: CompanyFinancialMetric["statementType"] = "income_statement",
): CompanyFinancialMetric {
  return {
    id: `${periodId}-${metricKey}`,
    periodId,
    statementType,
    metricKey,
    value: new Decimal(value),
    unitScale: "unit",
    provider: "twelve_data",
  };
}

describe("CompanyRatiosPanel", () => {
  it("computes and shows available ratios from stored statement figures", () => {
    const metrics = [
      metric("period-1", "revenue", 1000),
      metric("period-1", "net_income", 100),
      metric("period-1", "gross_profit", 400),
    ];
    render(
      <CompanyRatiosPanel
        lookup={buildMetricLookup(metrics)}
        latestPeriodId="period-1"
        priorPeriodId={null}
        latestPrice={null}
        statementCurrency="INR"
        allMetrics={metrics}
      />,
    );

    expect(screen.getByText("Net profit margin")).toBeInTheDocument();
    expect(screen.getByText("10.00%")).toBeInTheDocument();
    expect(screen.getByText("Gross margin")).toBeInTheDocument();
    expect(screen.getByText("40.00%")).toBeInTheDocument();
  });

  it("names the exact reason a ratio is unavailable, never showing a fabricated zero", () => {
    const metrics = [metric("period-1", "revenue", 1000)];
    render(
      <CompanyRatiosPanel
        lookup={buildMetricLookup(metrics)}
        latestPeriodId="period-1"
        priorPeriodId={null}
        latestPrice={null}
        statementCurrency="INR"
        allMetrics={metrics}
      />,
    );

    expect(
      screen.getAllByText(/Unavailable — Not reported for this period/).length,
    ).toBeGreaterThan(0);
  });

  it("shows valuation ratios unavailable when there is no stored price", () => {
    const metrics = [metric("period-1", "revenue", 1000)];
    render(
      <CompanyRatiosPanel
        lookup={buildMetricLookup(metrics)}
        latestPeriodId="period-1"
        priorPeriodId={null}
        latestPrice={null}
        statementCurrency="INR"
        allMetrics={metrics}
      />,
    );

    expect(
      screen.getByText(/need both a stored market price/),
    ).toBeInTheDocument();
  });

  it("shows provider-supplied ratios separately from calculated ones", () => {
    const metrics = [
      metric("period-1", "revenue", 1000),
      metric("period-1", "pe_ratio", 22.5, "ratio"),
    ];
    render(
      <CompanyRatiosPanel
        lookup={buildMetricLookup(metrics)}
        latestPeriodId="period-1"
        priorPeriodId={null}
        latestPrice={null}
        statementCurrency="INR"
        allMetrics={metrics}
      />,
    );

    expect(
      screen.getByText(/Provider-supplied ratios \(twelve_data\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("22.50")).toBeInTheDocument();
  });

  it("shows the formula version disclosure", () => {
    render(
      <CompanyRatiosPanel
        lookup={buildMetricLookup([])}
        latestPeriodId={null}
        priorPeriodId={null}
        latestPrice={null}
        statementCurrency={null}
        allMetrics={[]}
      />,
    );

    expect(screen.getByText(/Formula version v1/)).toBeInTheDocument();
  });
});
