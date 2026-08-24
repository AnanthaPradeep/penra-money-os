import type { Money } from "@/lib/money/decimal";
import type { CompanyFinancialMetric } from "@/lib/research/mapping";
import type { CompanyFinancialPeriod } from "@/lib/research/mapping";
import type { MetricKey, PeriodType } from "@/lib/research/types";

/** One (period, metric) value lookup keyed by period id, then metric key — built once per page render and passed to every ratio/statement-table computation, rather than each caller re-filtering the flat metrics array. */
export type MetricLookup = ReadonlyMap<string, ReadonlyMap<MetricKey, Money>>;

export function buildMetricLookup(
  metrics: readonly CompanyFinancialMetric[],
): MetricLookup {
  const byPeriod = new Map<string, Map<MetricKey, Money>>();
  for (const metric of metrics) {
    let periodMap = byPeriod.get(metric.periodId);
    if (!periodMap) {
      periodMap = new Map();
      byPeriod.set(metric.periodId, periodMap);
    }
    periodMap.set(metric.metricKey, metric.value);
  }
  return byPeriod;
}

/** The value of one metric for one period, or null when the provider never reported it — never a fabricated 0. */
export function getMetricValue(
  lookup: MetricLookup,
  periodId: string,
  key: MetricKey,
): Money | null {
  return lookup.get(periodId)?.get(key) ?? null;
}

/** Periods of one type (annual/quarterly), most-recent fiscal-period-end first. Mixing annual and quarterly rows into one trend is exactly what this split guards against — every caller that wants "the last N periods" must pick a period type first. */
export function filterPeriodsByType(
  periods: readonly CompanyFinancialPeriod[],
  periodType: PeriodType,
): CompanyFinancialPeriod[] {
  return periods
    .filter((p) => p.periodType === periodType)
    .sort((a, b) => (a.fiscalPeriodEnd < b.fiscalPeriodEnd ? 1 : -1));
}

/** The most recent period of a given type, or null if none exist yet. */
export function getLatestPeriod(
  periods: readonly CompanyFinancialPeriod[],
  periodType: PeriodType,
): CompanyFinancialPeriod | null {
  return filterPeriodsByType(periods, periodType)[0] ?? null;
}

/** The period immediately before `period` of the same type — used for period-over-period growth ratios. Matches on fiscal_period_end strictly earlier than the reference period's, never assumes a fixed calendar offset (a company's periods may not be evenly spaced if a provider revision changed the reporting calendar). */
export function getPriorPeriod(
  periods: readonly CompanyFinancialPeriod[],
  period: CompanyFinancialPeriod,
): CompanyFinancialPeriod | null {
  const sameType = filterPeriodsByType(periods, period.periodType);
  const index = sameType.findIndex((p) => p.id === period.id);
  if (index === -1) {
    return null;
  }
  return sameType[index + 1] ?? null;
}
