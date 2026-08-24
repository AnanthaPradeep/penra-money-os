"use client";

import { useState } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type {
  CompanyFinancialMetric,
  CompanyFinancialPeriod,
} from "@/lib/research/mapping";
import {
  buildMetricLookup,
  filterPeriodsByType,
  getMetricValue,
} from "@/lib/research/statements";
import {
  BALANCE_SHEET_METRIC_KEYS,
  CASH_FLOW_METRIC_KEYS,
  INCOME_STATEMENT_METRIC_KEYS,
  METRIC_LABELS,
  STATEMENT_TYPE_LABELS,
  type MetricKey,
  type PeriodType,
  type UnitScale,
} from "@/lib/research/types";

const MAX_PERIODS_SHOWN = 6;

const UNIT_SCALE_LABELS: Record<UnitScale, string> = {
  unit: "",
  thousand: "thousands",
  million: "millions",
  crore: "crore",
  lakh: "lakh",
};

function formatValue(value: ReturnType<typeof getMetricValue>): string {
  if (value === null) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    value.toNumber(),
  );
}

function StatementTable({
  title,
  metricKeys,
  periods,
  metrics,
}: Readonly<{
  title: string;
  metricKeys: readonly MetricKey[];
  periods: readonly CompanyFinancialPeriod[];
  metrics: readonly CompanyFinancialMetric[];
}>) {
  const lookup = buildMetricLookup(metrics);
  const shownPeriods = periods.slice(0, MAX_PERIODS_SHOWN);

  if (shownPeriods.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">
          No {title.toLowerCase()} data available for this period type yet.
        </p>
      </div>
    );
  }

  const unitScalesInUse = new Set<UnitScale>();
  for (const metric of metrics) {
    if (metricKeys.includes(metric.metricKey)) {
      unitScalesInUse.add(metric.unitScale);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted-surface">
              <th className="sticky left-0 bg-muted-surface px-3 py-2 text-left font-medium text-muted-foreground">
                Metric
              </th>
              {shownPeriods.map((period) => (
                <th
                  key={period.id}
                  className="px-3 py-2 text-right font-medium text-muted-foreground"
                >
                  {period.fiscalPeriodEnd}
                  {period.periodType === "quarterly" && period.fiscalQuarter
                    ? ` (Q${period.fiscalQuarter})`
                    : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricKeys.map((key) => (
              <tr key={key} className="border-b border-border last:border-0">
                <td className="sticky left-0 bg-elevated px-3 py-2 whitespace-nowrap text-foreground">
                  {METRIC_LABELS[key]}
                </td>
                {shownPeriods.map((period) => (
                  <td
                    key={period.id}
                    className="px-3 py-2 text-right tabular-nums text-foreground"
                  >
                    {formatValue(getMetricValue(lookup, period.id, key))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {shownPeriods[0]?.currency ?? ""}
        {unitScalesInUse.size > 0
          ? ` · reported in ${
              Array.from(unitScalesInUse)
                .filter((scale) => UNIT_SCALE_LABELS[scale])
                .map((scale) => UNIT_SCALE_LABELS[scale])
                .join(", ") || "units"
            }`
          : ""}
        {" · "}
        {shownPeriods[0]?.statementBasis} · {shownPeriods[0]?.provider}
      </p>
    </div>
  );
}

type FinancialStatementsViewProps = {
  periods: CompanyFinancialPeriod[];
  metrics: CompanyFinancialMetric[];
};

/**
 * Full income-statement/balance-sheet/cash-flow tables with an
 * annual/quarterly toggle — the two period types are never displayed in
 * the same table (see filterPeriodsByType's own doc comment for why), and
 * every value is shown alongside its currency, unit scale, statement
 * basis, and provider rather than a bare number.
 */
export function FinancialStatementsView({
  periods,
  metrics,
}: Readonly<FinancialStatementsViewProps>) {
  const [periodType, setPeriodType] = useState<PeriodType>("annual");
  const shownPeriods = filterPeriodsByType(periods, periodType);
  const shownPeriodIds = new Set(shownPeriods.map((p) => p.id));
  const shownMetrics = metrics.filter((m) => shownPeriodIds.has(m.periodId));

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        label="Period type"
        value={periodType}
        onChange={setPeriodType}
        options={[
          { value: "annual", label: "Annual" },
          { value: "quarterly", label: "Quarterly" },
        ]}
      />
      <StatementTable
        title={STATEMENT_TYPE_LABELS.income_statement}
        metricKeys={INCOME_STATEMENT_METRIC_KEYS}
        periods={shownPeriods}
        metrics={shownMetrics}
      />
      <StatementTable
        title={STATEMENT_TYPE_LABELS.balance_sheet}
        metricKeys={BALANCE_SHEET_METRIC_KEYS}
        periods={shownPeriods}
        metrics={shownMetrics}
      />
      <StatementTable
        title={STATEMENT_TYPE_LABELS.cash_flow}
        metricKeys={CASH_FLOW_METRIC_KEYS}
        periods={shownPeriods}
        metrics={shownMetrics}
      />
    </div>
  );
}
