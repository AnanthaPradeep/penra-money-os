import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import type { MarketInstrument } from "@/lib/market-data/mapping";
import type {
  CompanyFinancialMetric,
  CompanyFinancialPeriod,
} from "@/lib/research/mapping";

import {
  CompareTable,
  type CompanyComparisonData,
} from "@/components/research/CompareTable";

function instrument(overrides: Partial<MarketInstrument>): MarketInstrument {
  return {
    id: "instrument-1",
    provider: "twelve_data",
    providerInstrumentId: "TCS",
    symbol: "TCS",
    exchange: "NSE",
    mic: null,
    isin: null,
    name: "Tata Consultancy Services",
    instrumentKind: "stock",
    quoteCurrency: "INR",
    timezone: "Asia/Kolkata",
    isActive: true,
    lastSuccessfulRefreshAt: null,
    ...overrides,
  };
}

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

function company(
  overrides: Partial<CompanyComparisonData> & { instrumentId?: string } = {},
): CompanyComparisonData {
  const instrumentId = overrides.instrumentId ?? "instrument-1";
  return {
    instrument: instrument({ id: instrumentId }),
    periods: [period({ id: `${instrumentId}-period`, instrumentId })],
    metrics: [
      metric(`${instrumentId}-period`, "revenue", 1000),
      metric(`${instrumentId}-period`, "net_income", 100),
    ],
    latestPrice: { value: new Decimal(3500), currency: "INR" },
    ...overrides,
  };
}

describe("CompareTable", () => {
  it("shows every company as a column with its latest annual period", () => {
    render(
      <CompareTable
        companies={[
          company({}),
          company({
            instrumentId: "instrument-2",
            instrument: instrument({
              id: "instrument-2",
              name: "Infosys",
            }),
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Tata Consultancy Services" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Infosys" })).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("shows Unavailable rather than a fabricated zero for a missing metric", () => {
    render(
      <CompareTable
        companies={[
          company({ metrics: [] }),
          company({
            instrumentId: "instrument-2",
            instrument: instrument({ id: "instrument-2", name: "Infosys" }),
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("warns about mixed currencies instead of silently converting", () => {
    render(
      <CompareTable
        companies={[
          company({}),
          company({
            instrumentId: "instrument-2",
            instrument: instrument({ id: "instrument-2", name: "Apple Inc" }),
            periods: [
              period({
                id: "instrument-2-period",
                instrumentId: "instrument-2",
                currency: "USD",
              }),
            ],
            metrics: [
              metric("instrument-2-period", "revenue", 5000),
              metric("instrument-2-period", "net_income", 800),
            ],
            latestPrice: { value: new Decimal(180), currency: "USD" },
          }),
        ]}
      />,
    );

    expect(
      screen.getByText(/report in different currencies/),
    ).toBeInTheDocument();
  });

  it("never shows a mixed-currency warning when every company shares one currency", () => {
    render(
      <CompareTable
        companies={[
          company({}),
          company({
            instrumentId: "instrument-2",
            instrument: instrument({ id: "instrument-2", name: "Infosys" }),
          }),
        ]}
      />,
    );

    expect(
      screen.queryByText(/report in different currencies/),
    ).not.toBeInTheDocument();
  });
});
