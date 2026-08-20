import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, PlusCircle, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";

import { HoldingRow } from "@/components/investments/HoldingRow";
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
  const [holdings, portfolioSummary, allocation, maturityEvents, ppfSummary] =
    await Promise.all([
      getHoldingSummaries(supabase),
      getPrimaryPortfolioSummary(supabase),
      getAllocationByKind(supabase),
      getUpcomingMaturityEvents(supabase, 90),
      getPpfFinancialYearSummary(supabase, currentIndianFinancialYearStart()),
    ]);

  const activeHoldings = holdings.filter((h) => h.status === "active");
  const hasHoldings = holdings.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Investments"
        description="Manually tracked stocks, mutual funds, PPF, fixed deposits, recurring deposits, and more."
        actions={
          <Button asChild>
            <Link href="/app/investments/new">
              <PlusCircle aria-hidden="true" className="size-4" />
              New investment
            </Link>
          </Button>
        }
      />

      {!hasHoldings ? (
        <EmptyState
          icon={<TrendingUp aria-hidden="true" className="size-6" />}
          title="Track your first investment"
          description="Stocks, mutual funds, PPF, fixed deposits, and recurring deposits — every value here is either your own manual valuation or derived from your recorded activity, never a live market feed."
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
                  manual valuations + cost basis
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
              no manual valuation yet — shown at cost basis until you add one.
            </div>
          ) : null}

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
