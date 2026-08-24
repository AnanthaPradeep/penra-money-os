import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProviderStatusCard } from "@/components/market-data/ProviderStatusCard";
import { RefreshMarketDataButton } from "@/components/market-data/RefreshMarketDataButton";
import { Alert } from "@/components/ui/Alert";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getHoldingSummaries,
  listInvestmentAssets,
} from "@/lib/investments/queries";
import { getMarketDataProviderStates } from "@/lib/market-data/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Market data — PENRA Money OS",
};

const LINKABLE_ASSET_KINDS = new Set(["stock", "mutual_fund"]);

export default async function MarketDataSettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/settings/market-data");
  }

  const supabase = await createSupabaseServerClient();
  const [providerStates, assets, holdingSummaries] = await Promise.all([
    getMarketDataProviderStates(supabase),
    listInvestmentAssets(supabase),
    getHoldingSummaries(supabase),
  ]);

  const linkableActiveAssets = assets.filter(
    (a) => a.status === "active" && LINKABLE_ASSET_KINDS.has(a.assetKind),
  );
  const linkedCount = linkableActiveAssets.filter(
    (a) => a.marketInstrumentId !== null,
  ).length;
  const missingMappingCount = linkableActiveAssets.length - linkedCount;

  const activeHoldings = holdingSummaries.filter((h) => h.status === "active");
  const staleOrDelayedCount = activeHoldings.filter(
    (h) => h.priceStatus === "stale" || h.priceStatus === "delayed",
  ).length;
  const missingValuationCount = activeHoldings.filter(
    (h) => !h.hasValuation,
  ).length;
  const coveragePercent =
    activeHoldings.length > 0
      ? Math.round(
          ((activeHoldings.length - missingValuationCount) /
            activeHoldings.length) *
            100,
        )
      : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow={
          <BackLink href="/app/investments">Back to investments</BackLink>
        }
        title="Market data"
        description="Where your holdings' prices and NAVs come from, and how fresh they are."
      />

      <Alert variant="info" title="Every price here is delayed, not live">
        AMFI mutual-fund NAVs are published once per business day after market
        close. Stock prices, when a provider is configured, are also not
        real-time. Manually tracked holdings show your own entered valuation
        instead. None of this ever affects your ledger, cash balances, or cost
        basis — only the estimated current value shown for each holding.
      </Alert>

      <section
        aria-labelledby="providers-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="providers-heading" title="Providers" />
        {providerStates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No provider state recorded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {providerStates.map((state) => (
              <ProviderStatusCard key={state.provider} state={state} />
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="coverage-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="coverage-heading" title="Your holdings" />
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 p-4 text-sm">
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Linked to a provider</p>
              <p className="text-lg font-semibold text-foreground">
                {linkedCount} / {linkableActiveAssets.length}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Missing a mapping</p>
              <p className="text-lg font-semibold text-foreground">
                {missingMappingCount}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Stale or delayed prices</p>
              <p className="text-lg font-semibold text-foreground">
                {staleOrDelayedCount}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">Valuation coverage</p>
              <p className="text-lg font-semibold text-foreground">
                {coveragePercent === null ? "—" : `${coveragePercent}%`}
              </p>
            </div>
          </CardContent>
        </Card>
        {missingMappingCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            {missingMappingCount}{" "}
            {missingMappingCount === 1 ? "holding needs" : "holdings need"} a
            scheme/symbol link before automated pricing can apply.{" "}
            <Link href="/app/investments" className="text-primary underline">
              Review your investments
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="refresh-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="refresh-heading" title="Manual refresh" />
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm text-muted-foreground">
              Prices refresh automatically on a daily schedule. You can also
              trigger a refresh for your own linked holdings — limited to once
              every 15 minutes.
            </p>
            <RefreshMarketDataButton />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
