import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, PlusCircle, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";

import { HoldingRow } from "@/components/investments/HoldingRow";
import { TimeSeriesChart } from "@/components/market-data/TimeSeriesChart";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getAllocationByKind,
  getHoldingSummaries,
  getPrimaryPortfolioSummary,
  getPpfFinancialYearSummary,
  getUpcomingMaturityEvents,
} from "@/lib/investments/queries";
import {
  currentIndianFinancialYearStart,
  INVESTMENT_ASSET_KIND_LABELS,
} from "@/lib/investments/types";
import { computeTwr } from "@/lib/market-data/performance";
import { getPortfolioValueSnapshots } from "@/lib/market-data/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Investments — PENRA Money OS",
};

export default async function InvestmentsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/investments");
  }

  const supabase = await createSupabaseServerClient();
  const [
    holdings,
    portfolioSummary,
    allocation,
    maturityEvents,
    ppfSummary,
    portfolioValueSnapshots,
  ] = await Promise.all([
    getHoldingSummaries(supabase),
    getPrimaryPortfolioSummary(supabase),
    getAllocationByKind(supabase),
    getUpcomingMaturityEvents(supabase, 90),
    getPpfFinancialYearSummary(supabase, currentIndianFinancialYearStart()),
    getPortfolioValueSnapshots(supabase, "INR"),
  ]);

  const activeHoldings = holdings.filter((h) => h.status === "active");
  const hasHoldings = holdings.length > 0;

  const twrResult = computeTwr(
    portfolioValueSnapshots.map((s) => ({
      date: s.snapshotDate,
      value: s.valuedTotal,
      externalCashFlow: s.externalCashFlow,
    })),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Investments"
        description="Stocks, mutual funds, PPF, fixed deposits, recurring deposits, and more."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/app/settings/market-data">Market data</Link>
            </Button>
            <Button asChild>
              <Link href="/app/investments/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                New investment
              </Link>
            </Button>
          </div>
        }
      />

      {!hasHoldings ? (
        <EmptyState
          icon={<TrendingUp aria-hidden="true" className="size-6" />}
          title="Track your first investment"
          description="Stocks, mutual funds, PPF, fixed deposits, and recurring deposits — values come from official AMFI NAV data, a configured stock-price provider, your own manual valuation, or cost basis as a last resort. Provider data is end-of-day, never a live feed."
          action={
            <Button asChild>
              <Link href="/app/investments/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                New investment
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex flex-col gap-1 p-4 pt-4">
                <p className="text-sm text-muted-foreground">Invested cost</p>
                <AmountDisplay
                  value={portfolioSummary.totalInvestedCost}
                  size="lg"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4 pt-4">
                <p className="text-sm text-muted-foreground">Current value</p>
                <AmountDisplay
                  value={portfolioSummary.totalCurrentValue}
                  size="lg"
                />
                <p className="text-xs text-muted-foreground">
                  provider prices, manual valuations, or cost basis
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Unrealized gain/loss
                </p>
                <AmountDisplay
                  value={portfolioSummary.totalUnrealizedGain}
                  size="lg"
                  variant="signed"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Realized gain/loss
                </p>
                <AmountDisplay
                  value={portfolioSummary.totalRealizedGain}
                  size="lg"
                  variant="signed"
                />
                <p className="text-xs text-muted-foreground">
                  +{" "}
                  <AmountDisplay
                    value={portfolioSummary.totalIncomeReceived}
                    size="sm"
                  />{" "}
                  income received
                </p>
              </CardContent>
            </Card>
          </div>

          {portfolioSummary.missingValuationCount > 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
              {portfolioSummary.missingValuationCount}{" "}
              {portfolioSummary.missingValuationCount === 1
                ? "holding has"
                : "holdings have"}{" "}
              no valuation yet — shown at cost basis until a market price or
              manual valuation is added.
            </div>
          ) : null}

          <section
            aria-labelledby="performance-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="performance-heading"
              title="Portfolio performance"
            />
            {twrResult.status === "available" ? (
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Time-weighted return
                  </p>
                  <p
                    className={
                      twrResult.twrPercent.isNegative()
                        ? "text-xl font-semibold text-negative"
                        : "text-xl font-semibold text-positive"
                    }
                  >
                    {twrResult.twrPercent.toDecimalPlaces(2).toString()}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    chained across {twrResult.periodsUsed} daily snapshot
                    {twrResult.periodsUsed === 1 ? "" : "s"} — neutralizes the
                    effect of deposits/withdrawals, unlike absolute return
                  </p>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">
                Insufficient daily snapshot history for a time-weighted return
                yet — check back after a few days of automated snapshots.
              </p>
            )}
            <TimeSeriesChart
              points={portfolioValueSnapshots.map((s) => ({
                date: s.snapshotDate,
                value: s.valuedTotal,
              }))}
              title="Portfolio value"
              formatValue={(v) => v.toDecimalPlaces(2).toString()}
            />
          </section>

          {allocation.length > 0 ? (
            <section
              aria-labelledby="allocation-heading"
              className="flex flex-col gap-3"
            >
              <SectionHeader
                id="allocation-heading"
                title="Allocation by kind"
              />
              <ul className="flex flex-col gap-2">
                {allocation.map((row) => (
                  <li
                    key={row.assetKind}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {INVESTMENT_ASSET_KIND_LABELS[row.assetKind]}
                    </span>
                    <span className="flex items-center gap-2">
                      <AmountDisplay value={row.currentValue} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {row.percentOfPortfolio.toString()}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {maturityEvents.length > 0 ? (
            <section
              aria-labelledby="maturity-heading"
              className="flex flex-col gap-3"
            >
              <SectionHeader
                id="maturity-heading"
                title="Upcoming maturity (next 90 days)"
              />
              <ul className="flex flex-col gap-2">
                {maturityEvents.map((event) => (
                  <li
                    key={event.holdingId}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {event.displayName}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {event.maturityDate}
                      {event.expectedMaturityAmount ? (
                        <AmountDisplay
                          value={event.expectedMaturityAmount}
                          size="sm"
                        />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {ppfSummary.length > 0 ? (
            <section
              aria-labelledby="ppf-heading"
              className="flex flex-col gap-3"
            >
              <SectionHeader
                id="ppf-heading"
                title={`PPF contributions this financial year`}
              />
              <ul className="flex flex-col gap-2">
                {ppfSummary.map((row) => (
                  <li
                    key={row.holdingId}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {row.displayName}
                    </span>
                    <AmountDisplay value={row.totalContributions} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            aria-labelledby="holdings-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="holdings-heading"
              title={`${activeHoldings.length} active ${activeHoldings.length === 1 ? "holding" : "holdings"}`}
            />
            <ul className="flex flex-col gap-2">
              {holdings.map((holding) => (
                <li key={holding.holdingId}>
                  <HoldingRow holding={holding} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
