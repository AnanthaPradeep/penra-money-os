import { useId } from "react";

import type { Money } from "@/lib/money/decimal";

export type TimeSeriesPoint = {
  date: string;
  value: Money;
};

type TimeSeriesChartProps = {
  points: readonly TimeSeriesPoint[];
  /** e.g. "NAV" or "Portfolio value" — used in the chart's accessible label and the data-table caption. */
  title: string;
  /** How to render one value for display — defaults to a plain 2-decimal string (no currency symbol, since not every series is money in the account's base currency, e.g. a per-unit NAV). */
  formatValue?: (value: Money) => string;
};

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 24, left: 16 };

function defaultFormat(value: Money): string {
  return value.toDecimalPlaces(2).toString();
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A dependency-free, accessible SVG line chart for a real observed time
 * series (price/NAV history, portfolio-value history). Every point is a
 * genuine stored observation — points are spaced evenly by index, not by
 * elapsed calendar time, so a gap in the underlying data (a market holiday,
 * a missed refresh) never gets smoothed or interpolated away; it's simply a
 * straight segment between whichever two dates actually have data, and the
 * exact date of every point is always available in the accompanying data
 * table for anyone who needs to see the gap explicitly. Renders an honest
 * empty/single-point state instead of a fabricated chart when there isn't
 * enough data to draw a line.
 */
export function TimeSeriesChart({
  points,
  title,
  formatValue = defaultFormat,
}: Readonly<TimeSeriesChartProps>) {
  const titleId = useId();
  const descId = useId();

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No {title.toLowerCase()} history recorded yet.
      </div>
    );
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const values = points.map((p) => p.value);
  const minValue = values.reduce((a, b) => (b.lessThan(a) ? b : a));
  const maxValue = values.reduce((a, b) => (b.greaterThan(a) ? b : a));
  const range = maxValue.minus(minValue);
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  function xFor(index: number): number {
    if (points.length === 1) {
      return PADDING.left + plotWidth / 2;
    }
    return PADDING.left + (index / (points.length - 1)) * plotWidth;
  }

  function yFor(value: Money): number {
    if (range.isZero()) {
      return PADDING.top + plotHeight / 2;
    }
    const fraction = value.minus(minValue).dividedBy(range).toNumber();
    return PADDING.top + (1 - fraction) * plotHeight;
  }

  const pathD = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${xFor(index)},${yFor(point.value)}`,
    )
    .join(" ");

  const summary = `${title} from ${formatDateLabel(first.date)} (${formatValue(first.value)}) to ${formatDateLabel(last.date)} (${formatValue(last.value)}), ${points.length} observation${points.length === 1 ? "" : "s"}.`;

  return (
    <figure className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full text-primary"
        preserveAspectRatio="none"
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{summary}</desc>
        <line
          x1={PADDING.left}
          y1={CHART_HEIGHT - PADDING.bottom}
          x2={CHART_WIDTH - PADDING.right}
          y2={CHART_HEIGHT - PADDING.bottom}
          className="stroke-border"
          strokeWidth={1}
        />
        {points.length > 1 ? (
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} />
        ) : null}
        {points.map((point, index) => (
          <circle
            key={point.date}
            cx={xFor(index)}
            cy={yFor(point.value)}
            r={points.length === 1 ? 4 : 2.5}
            fill="currentColor"
          />
        ))}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        {summary}
      </figcaption>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          View as a table
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title} by date</caption>
            <thead className="sticky top-0 bg-elevated text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="p-2">
                  Date
                </th>
                <th scope="col" className="p-2">
                  {title}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-t border-border">
                  <td className="p-2 text-foreground">
                    {formatDateLabel(point.date)}
                  </td>
                  <td className="p-2 tabular-nums text-foreground">
                    {formatValue(point.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
