import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import type {
  CompanyFinancialMetric,
  CompanyFinancialPeriod,
} from "@/lib/research/mapping";

import { FinancialStatementsView } from "@/components/research/FinancialStatementsView";

function period(
  overrides: Partial<CompanyFinancialPeriod>,
): CompanyFinancialPeriod {
  return {
    id: "period-1",
    instrumentId: "instrument-1",
    periodType: "annual",
    fiscalPeriodEnd: "2025-03-31",
    fiscalYear: 2025,
    fiscalQuarter: null,
    reportDate: null,
    currency: "INR",
    statementBasis: "consolidated",
    provider: "twelve_data",
    ...overrides,
  };
}

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

describe("FinancialStatementsView", () => {
  const periods = [
    period({
      id: "annual-1",
      periodType: "annual",
      fiscalPeriodEnd: "2025-03-31",
    }),
    period({
      id: "quarterly-1",
      periodType: "quarterly",
      fiscalPeriodEnd: "2025-06-30",
      fiscalQuarter: 1,
    }),
  ];
  const metrics = [
    metric("annual-1", "revenue", 100000),
    metric("quarterly-1", "revenue", 26000),
  ];

  it("defaults to the annual view and never mixes quarterly rows into it", () => {
    render(<FinancialStatementsView periods={periods} metrics={metrics} />);

    expect(screen.getAllByText("2025-03-31").length).toBeGreaterThan(0);
    expect(screen.queryByText(/2025-06-30/)).not.toBeInTheDocument();
  });

  it("switches to the quarterly view without showing annual periods", async () => {
    const user = userEvent.setup();
    render(<FinancialStatementsView periods={periods} metrics={metrics} />);

    await user.click(screen.getByRole("radio", { name: "Quarterly" }));

    expect(screen.getAllByText(/2025-06-30/).length).toBeGreaterThan(0);
    expect(screen.queryByText("2025-03-31")).not.toBeInTheDocument();
  });

  it("shows an empty message when no period of the selected type exists yet", () => {
    const quarterlyOnly = [periods[1]!];
    render(
      <FinancialStatementsView periods={quarterlyOnly} metrics={metrics} />,
    );

    // Default view is "Annual", and no annual period exists in this data.
    expect(
      screen.getByText(/No income statement data available/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No balance sheet data available/),
    ).toBeInTheDocument();
  });
});
