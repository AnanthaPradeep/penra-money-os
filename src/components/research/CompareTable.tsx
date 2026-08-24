import Link from "next/link";

import type { Money } from "@/lib/money/decimal";
import type { MarketInstrument } from "@/lib/market-data/mapping";
import * as ratios from "@/lib/research/ratios";
import type { RatioResult } from "@/lib/research/ratios";
import type {
  CompanyFinancialMetric,
  CompanyFinancialPeriod,
} from "@/lib/research/mapping";
import {
  buildMetricLookup,
  getLatestPeriod,
  getMetricValue,
  getPriorPeriod,
} from "@/lib/research/statements";

export type CompanyComparisonData = {
  instrument: MarketInstrument;
  periods: CompanyFinancialPeriod[];
  metrics: CompanyFinancialMetric[];
  latestPrice: { value: Money; currency: string } | null;
};

function formatCell(value: Money | null): string {
  if (value === null) {
    return "Unavailable";
  }
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    value.toNumber(),
  );
}

function formatRatioCell(result: RatioResult, isPercent?: boolean): string {
  if (result.status === "unavailable") {
    return "Unavailable";
  }
  return `${result.value.toFixed(2)}${isPercent ? "%" : ""}`;
}

/**
 * Bounded to 2-5 companies (enforced by CompareSelector) with each row
 * clearly labelled and no cross-currency arithmetic — a company reported
 * in a different currency from its peers has its own currency shown next
 * to every one of its values rather than being silently converted.
 */
export function CompareTable({
  companies,
}: Readonly<{ companies: CompanyComparisonData[] }>) {
  const rows = companies.map((c) => {
    const latestAnnual = getLatestPeriod(c.periods, "annual");
    const priorAnnual = latestAnnual
      ? getPriorPeriod(c.periods, latestAnnual)
      : null;
    const lookup = buildMetricLookup(c.metrics);
    const get = (key: Parameters<typeof getMetricValue>[2]) =>
      latestAnnual ? getMetricValue(lookup, latestAnnual.id, key) : null;
    const getPrior = (key: Parameters<typeof getMetricValue>[2]) =>
      priorAnnual ? getMetricValue(lookup, priorAnnual.id, key) : null;

    const revenue = get("revenue");
    const netIncome = get("net_income");
    const shareholderEquity = get("shareholder_equity");
    const totalAssets = get("total_assets");
    const totalLiabilities = get("total_liabilities");
    const totalDebt = get("total_debt");
    const currentAssets = get("current_assets");
    const currentLiabilities = get("current_liabilities");
    const sharesOutstanding = get("shares_outstanding");

    const priceRatioInput =
      c.latestPrice && latestAnnual
        ? {
            marketPrice: c.latestPrice.value,
            priceCurrency: c.latestPrice.currency,
            sharesOutstanding,
            statementCurrency: latestAnnual.currency,
          }
        : null;

    return {
      instrument: c.instrument,
      period: latestAnnual,
      currency: latestAnnual?.currency ?? c.latestPrice?.currency ?? null,
      revenue,
      revenueGrowth: ratios.computeRevenueGrowth(revenue, getPrior("revenue")),
      netIncome,
      netMargin: ratios.computeNetProfitMargin(netIncome, revenue),
      roe: ratios.computeReturnOnEquity(netIncome, shareholderEquity),
      roa: ratios.computeReturnOnAssets(netIncome, totalAssets),
      debtToEquity: ratios.computeDebtToEquity(totalDebt, shareholderEquity),
      currentRatio: ratios.computeCurrentRatio(
        currentAssets,
        currentLiabilities,
      ),
      totalAssets,
      totalLiabilities,
      shareholderEquity,
      marketPrice: c.latestPrice,
      pe: priceRatioInput
        ? ratios.computePriceToEarnings(priceRatioInput, netIncome)
        : ({ status: "unavailable", reason: "missing_input" } as const),
      pb: priceRatioInput
        ? ratios.computePriceToBook(priceRatioInput, shareholderEquity)
        : ({ status: "unavailable", reason: "missing_input" } as const),
      ps: priceRatioInput
        ? ratios.computePriceToSales(priceRatioInput, revenue)
        : ({ status: "unavailable", reason: "missing_input" } as const),
    };
  });

  const currencies = new Set(rows.map((r) => r.currency).filter(Boolean));

  return (
    <div className="flex flex-col gap-3">
      {currencies.size > 1 ? (
        <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
          These companies report in different currencies (
          {Array.from(currencies).join(", ")}). Figures are shown exactly as
          reported for each company — never converted to a common currency.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted-surface">
              <th className="sticky left-0 bg-muted-surface px-3 py-2 text-left font-medium text-muted-foreground">
                Metric
              </th>
              {rows.map((row) => (
                <th
                  key={row.instrument.id}
                  className="px-3 py-2 text-right font-medium text-muted-foreground"
                >
                  <Link
                    href={`/app/research/companies/${row.instrument.id}`}
                    className="text-primary hover:underline"
                  >
                    {row.instrument.name}
                  </Link>
                  <div className="font-normal">
                    {row.period
                      ? `${row.period.fiscalPeriodEnd} · ${row.currency}`
                      : "No annual data"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow
              label="Revenue"
              cells={rows.map((r) => formatCell(r.revenue))}
            />
            <ComparisonRow
              label="Revenue growth"
              cells={rows.map((r) => formatRatioCell(r.revenueGrowth, true))}
            />
            <ComparisonRow
              label="Net income"
              cells={rows.map((r) => formatCell(r.netIncome))}
            />
            <ComparisonRow
              label="Net margin"
              cells={rows.map((r) => formatRatioCell(r.netMargin, true))}
            />
            <ComparisonRow
              label="Return on equity"
              cells={rows.map((r) => formatRatioCell(r.roe, true))}
            />
            <ComparisonRow
              label="Return on assets"
              cells={rows.map((r) => formatRatioCell(r.roa, true))}
            />
            <ComparisonRow
              label="Total assets"
              cells={rows.map((r) => formatCell(r.totalAssets))}
            />
            <ComparisonRow
              label="Total liabilities"
              cells={rows.map((r) => formatCell(r.totalLiabilities))}
            />
            <ComparisonRow
              label="Shareholder equity"
              cells={rows.map((r) => formatCell(r.shareholderEquity))}
            />
            <ComparisonRow
              label="Debt-to-equity"
              cells={rows.map((r) => formatRatioCell(r.debtToEquity))}
            />
            <ComparisonRow
              label="Current ratio"
              cells={rows.map((r) => formatRatioCell(r.currentRatio))}
            />
            <ComparisonRow
              label="Market price"
              cells={rows.map((r) =>
                r.marketPrice
                  ? `${formatCell(r.marketPrice.value)} ${r.marketPrice.currency}`
                  : "Unavailable",
              )}
            />
            <ComparisonRow
              label="Price / earnings"
              cells={rows.map((r) => formatRatioCell(r.pe))}
            />
            <ComparisonRow
              label="Price / book"
              cells={rows.map((r) => formatRatioCell(r.pb))}
            />
            <ComparisonRow
              label="Price / sales"
              cells={rows.map((r) => formatRatioCell(r.ps))}
            />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Same-period-type (annual) comparison where available. An
        &quot;Unavailable&quot; cell is never shown as zero — see each
        company&apos;s own research page for the exact reason.
      </p>
    </div>
  );
}

function ComparisonRow({
  label,
  cells,
}: Readonly<{ label: string; cells: string[] }>) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="sticky left-0 bg-elevated px-3 py-2 whitespace-nowrap text-foreground">
        {label}
      </td>
      {cells.map((cell, index) => (
        <td
          key={index}
          className="px-3 py-2 text-right tabular-nums text-foreground"
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}
