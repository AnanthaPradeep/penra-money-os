import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TimeSeriesChart } from "@/components/market-data/TimeSeriesChart";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";
import { Decimal } from "@/lib/money/decimal";
import { getForecastCandidateData } from "@/lib/planning/forecast-items";
import {
  FORECAST_HORIZON_LABELS,
  runCashFlowForecast,
  type ForecastHorizon,
  type ForecastScenarioKind,
} from "@/lib/planning/forecast";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Forecast — PENRA Money OS" };

const HORIZON_OPTIONS = (
  Object.entries(FORECAST_HORIZON_LABELS) as [ForecastHorizon, string][]
).map(([value, label]) => ({ value, label }));

const SCENARIO_OPTIONS = [
  { value: "baseline", label: "Baseline" },
  { value: "conservative", label: "Conservative" },
];

const STATUS_COPY: Record<string, string> = {
  complete: "Every data category is available.",
  partial: "Some data categories (e.g. debts or budgets) aren't set up yet.",
  insufficient_data: "Not enough data to produce a meaningful forecast yet.",
  stale: "This forecast is based on a snapshot that may be out of date.",
};

export default async function ForecastPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    horizon?: string;
    scenario?: string;
    buffer?: string;
  }>;
}>) {
  const {
    horizon: horizonParam,
    scenario: scenarioParam,
    buffer,
  } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/forecast");
  }

  const horizon: ForecastHorizon =
    horizonParam === "3mo" ||
    horizonParam === "6mo" ||
    horizonParam === "12mo" ||
    horizonParam === "custom"
      ? horizonParam
      : "30d";
  const scenario: ForecastScenarioKind =
    scenarioParam === "conservative" ? "conservative" : "baseline";

  const supabase = await createSupabaseServerClient();
  const asOf = nowAsIstCalendarDate();
  const candidateData = await getForecastCandidateData(supabase, asOf);

  let bufferAmount = new Decimal(0);
  try {
    if (buffer) {
      bufferAmount = new Decimal(buffer);
    }
  } catch {
    bufferAmount = new Decimal(0);
  }
  if (bufferAmount.isNegative() || !bufferAmount.isFinite()) {
    bufferAmount = new Decimal(0);
  }

  const result = runCashFlowForecast({
    scenario,
    horizon,
    asOf,
    openingBalance: candidateData.openingBalance,
    items: candidateData.items,
    conservativeBufferAmount: bufferAmount,
    dataCompleteness: candidateData.dataCompleteness,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        title="Cash-flow forecast"
        description="A planning estimate from your real balances and already-scheduled items — never a guarantee of future income, expenses, or returns."
        actions={<Badge variant="neutral">{result.status}</Badge>}
      />

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select
            id="forecast-horizon"
            name="horizon"
            label="Horizon"
            options={HORIZON_OPTIONS}
            defaultValue={horizon}
          />
        </div>
        <div className="w-44">
          <Select
            id="forecast-scenario"
            name="scenario"
            label="Scenario"
            options={SCENARIO_OPTIONS}
            defaultValue={scenario}
          />
        </div>
        {scenario === "conservative" ? (
          <div className="w-44">
            <Field
              id="forecast-buffer"
              name="buffer"
              label="Safety buffer"
              inputMode="decimal"
              defaultValue={buffer ?? "0"}
            />
          </div>
        ) : null}
        <Button type="submit" variant="outline">
          Update
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {STATUS_COPY[result.status]}
      </p>

      {result.shortfallDate ? (
        <div className="flex items-start gap-2 rounded-lg border border-negative/30 bg-negative-surface px-4 py-3 text-sm text-negative">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            Projected shortfall on {result.shortfallDate} — a low point of{" "}
            {result.lowestBalance.toString()} on {result.lowestBalanceDate}.
            This is an estimate; no automatic action has been or will be taken.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 pt-5">
            <span className="text-xs text-muted-foreground">Opening</span>
            <AmountDisplay value={result.openingBalance} size="md" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-5">
            <span className="text-xs text-muted-foreground">
              Projected closing
            </span>
            <AmountDisplay value={result.closingBalance} size="md" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-5">
            <span className="text-xs text-muted-foreground">Lowest point</span>
            <AmountDisplay value={result.lowestBalance} size="md" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-5">
            <span className="text-xs text-muted-foreground">
              Safe to spend today
            </span>
            <AmountDisplay value={result.safeToSpendToday} size="md" />
          </CardContent>
        </Card>
      </div>

      <TimeSeriesChart
        title="Projected balance"
        points={result.dailySeries.map((p) => ({
          date: p.date,
          value: p.balance,
        }))}
      />

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Included: {result.includedSources.join(", ") || "none"}
          {result.excludedSources.length > 0
            ? ` · Excluded: ${result.excludedSources.join(", ")}`
            : ""}
        </p>
        <ul className="flex flex-col gap-1 text-xs">
          {result.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
