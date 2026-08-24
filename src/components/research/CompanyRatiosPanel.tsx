import { Card, CardContent } from "@/components/ui/Card";
import type { Money } from "@/lib/money/decimal";
import { formatINR } from "@/lib/money/format";
import * as ratios from "@/lib/research/ratios";
import type { RatioResult } from "@/lib/research/ratios";
import type { CompanyFinancialMetric } from "@/lib/research/mapping";
import { getMetricValue, type MetricLookup } from "@/lib/research/statements";
import { METRIC_LABELS } from "@/lib/research/types";

const UNAVAILABLE_LABELS: Record<string, string> = {
  missing_input: "Not reported for this period",
  zero_denominator: "Denominator is zero",
  negative_denominator: "Denominator is negative",
  negative_base: "Base value is negative",
  currency_mismatch: "Price and statement currencies differ",
  incompatible_periods: "Periods aren't comparable",
};

function RatioRow({
  label,
  result,
  isPercent,
}: Readonly<{ label: string; result: RatioResult; isPercent?: boolean }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
      <span className="text-foreground">{label}</span>
      {result.status === "available" ? (
        <span className="font-medium tabular-nums text-foreground">
          {result.value.toFixed(2)}
          {isPercent ? "%" : ""}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          Unavailable — {UNAVAILABLE_LABELS[result.reason] ?? result.reason}
        </span>
      )}
    </div>
  );
}

type CompanyRatiosPanelProps = {
  lookup: MetricLookup;
  latestPeriodId: string | null;
  priorPeriodId: string | null;
  latestPrice: { value: Money; currency: string } | null;
  statementCurrency: string | null;
  allMetrics: readonly CompanyFinancialMetric[];
};

/**
 * Every ratio here is computed client-visible-side from stored statement
 * figures via src/lib/research/ratios.ts — never persisted, always
 * recomputed from the current is_current metrics, and every unavailable
 * ratio names the specific reason rather than showing a blank or a zero.
 * Provider-supplied ratios (pe_ratio/pb_ratio/ps_ratio/dividend_yield, when
 * a fundamentals provider is configured and has reported them) are shown
 * separately below, clearly labelled as provider data rather than our own
 * calculation — the two are never merged into one number.
 */
export function CompanyRatiosPanel({
  lookup,
  latestPeriodId,
  priorPeriodId,
  latestPrice,
  statementCurrency,
  allMetrics,
}: Readonly<CompanyRatiosPanelProps>) {
  const get = (key: Parameters<typeof getMetricValue>[2]) =>
    latestPeriodId ? getMetricValue(lookup, latestPeriodId, key) : null;
  const getPrior = (key: Parameters<typeof getMetricValue>[2]) =>
    priorPeriodId ? getMetricValue(lookup, priorPeriodId, key) : null;

  const revenue = get("revenue");
  const netIncome = get("net_income");
  const grossProfit = get("gross_profit");
  const operatingIncome = get("operating_income");
  const shareholderEquity = get("shareholder_equity");
  const totalAssets = get("total_assets");
  const totalDebt = get("total_debt");
  const currentAssets = get("current_assets");
  const currentLiabilities = get("current_liabilities");
  const interestExpense = get("interest_expense");
  const operatingCashFlow = get("operating_cash_flow");
  const capitalExpenditure = get("capital_expenditure");
  const freeCashFlow =
    operatingCashFlow && capitalExpenditure
      ? operatingCashFlow.minus(capitalExpenditure.abs())
      : null;

  const priceRatioInput =
    latestPrice && statementCurrency
      ? {
          marketPrice: latestPrice.value,
          priceCurrency: latestPrice.currency,
          sharesOutstanding: get("shares_outstanding"),
          statementCurrency,
        }
      : null;

  const providerRatioMetrics = allMetrics.filter(
    (m) => m.statementType === "ratio",
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col p-4">
          <p className="mb-1 text-sm font-medium text-foreground">
            Growth &amp; profitability
          </p>
          <RatioRow
            label="Revenue growth"
            result={ratios.computeRevenueGrowth(revenue, getPrior("revenue"))}
            isPercent
          />
          <RatioRow
            label="Net income growth"
            result={ratios.computeNetIncomeGrowth(
              netIncome,
              getPrior("net_income"),
            )}
            isPercent
          />
          <RatioRow
            label="Gross margin"
            result={ratios.computeGrossMargin(grossProfit, revenue)}
            isPercent
          />
          <RatioRow
            label="Operating margin"
            result={ratios.computeOperatingMargin(operatingIncome, revenue)}
            isPercent
          />
          <RatioRow
            label="Net profit margin"
            result={ratios.computeNetProfitMargin(netIncome, revenue)}
            isPercent
          />
          <RatioRow
            label="Return on equity"
            result={ratios.computeReturnOnEquity(netIncome, shareholderEquity)}
            isPercent
          />
          <RatioRow
            label="Return on assets"
            result={ratios.computeReturnOnAssets(netIncome, totalAssets)}
            isPercent
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col p-4">
          <p className="mb-1 text-sm font-medium text-foreground">
            Balance sheet &amp; coverage
          </p>
          <RatioRow
            label="Debt-to-equity"
            result={ratios.computeDebtToEquity(totalDebt, shareholderEquity)}
          />
          <RatioRow
            label="Current ratio"
            result={ratios.computeCurrentRatio(
              currentAssets,
              currentLiabilities,
            )}
          />
          <RatioRow
            label="Interest coverage"
            result={ratios.computeInterestCoverage(
              operatingIncome,
              interestExpense,
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col p-4">
          <p className="mb-1 text-sm font-medium text-foreground">Cash flow</p>
          <RatioRow
            label="Operating cash flow margin"
            result={ratios.computeOperatingCashFlowMargin(
              operatingCashFlow,
              revenue,
            )}
            isPercent
          />
          <RatioRow
            label="Free cash flow margin"
            result={ratios.computeFreeCashFlowMargin(freeCashFlow, revenue)}
            isPercent
          />
          <RatioRow
            label="Free cash flow conversion"
            result={ratios.computeFreeCashFlowConversion(
              freeCashFlow,
              netIncome,
            )}
            isPercent
          />
        </CardContent>
      </Card>

      {priceRatioInput ? (
        <Card>
          <CardContent className="flex flex-col p-4">
            <p className="mb-1 text-sm font-medium text-foreground">
              Valuation (calculated from stored price × shares outstanding)
            </p>
            <RatioRow
              label="Price / earnings"
              result={ratios.computePriceToEarnings(priceRatioInput, netIncome)}
            />
            <RatioRow
              label="Price / book"
              result={ratios.computePriceToBook(
                priceRatioInput,
                shareholderEquity,
              )}
            />
            <RatioRow
              label="Price / sales"
              result={ratios.computePriceToSales(priceRatioInput, revenue)}
            />
            <RatioRow
              label="Dividend yield"
              result={ratios.computeDividendYield(
                priceRatioInput,
                get("dividends_paid"),
              )}
              isPercent
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Valuation ratios need both a stored market price and a reported
          shares-outstanding figure for the same currency — unavailable until
          both exist.
        </p>
      )}

      {providerRatioMetrics.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col p-4">
            <p className="mb-1 text-sm font-medium text-foreground">
              Provider-supplied ratios ({providerRatioMetrics[0]?.provider})
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Reported directly by the data provider — not calculated by PENRA,
              and may use a different formula than the sections above.
            </p>
            {providerRatioMetrics.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
              >
                <span className="text-foreground">
                  {METRIC_LABELS[m.metricKey]}
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {m.value.toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Formula version {ratios.RATIO_FORMULA_VERSION}. Calculated ratios use
        the latest current annual period
        {latestPrice
          ? ` and a stored price of ${formatINR(latestPrice.value)} (${latestPrice.currency})`
          : ""}
        .
      </p>
    </div>
  );
}
