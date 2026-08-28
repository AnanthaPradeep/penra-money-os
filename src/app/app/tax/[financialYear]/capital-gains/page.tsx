import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TaxAssetClassificationForm } from "@/components/tax/TaxAssetClassificationForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCapitalGainsReportForYear } from "@/lib/tax/capital-gains-data";
import { isValidFinancialYearId, parseFinancialYearId } from "@/lib/tax/financial-year";
import { getTaxRuleSet } from "@/lib/tax/rules/registry";
import { listTaxAssetClassifications } from "@/lib/tax/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ financialYear: string }> };

export const metadata: Metadata = { title: "Capital gains — PENRA Money OS" };

const CATEGORY_LABELS: Record<string, string> = {
  listed_equity_stcg: "Listed equity — short-term",
  listed_equity_ltcg: "Listed equity — long-term",
  equity_mf_stcg: "Equity-oriented mutual fund — short-term",
  equity_mf_ltcg: "Equity-oriented mutual fund — long-term",
};

export default async function CapitalGainsPage({ params }: Readonly<PageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/capital-gains`);
  }

  const fy = parseFinancialYearId(financialYear);
  const ruleSetLookup = getTaxRuleSet(financialYear);

  const supabase = await createSupabaseServerClient();

  const { data: holdingRows } = await supabase
    .from("investment_holdings")
    .select("id, investment_asset_id, investment_assets(display_name, asset_kind)")
    .eq("status", "active");
  const classifications = await listTaxAssetClassifications(supabase);
  const classifiedAssetIds = new Set(classifications.map((c) => c.investmentAssetId));
  const unclassifiedHoldings = (holdingRows ?? []).filter(
    (h) => !classifiedAssetIds.has(h.investment_asset_id),
  );

  const capitalGains = ruleSetLookup.available
    ? await getCapitalGainsReportForYear(supabase, ruleSetLookup.ruleSet, fy)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/tax/${financialYear}`}>
            {`Back to ${fy.label}`}
          </BackLink>
        }
        title="Capital gains"
        description="Tax lots are matched independently of your portfolio's weighted-average accounting cost basis, using FIFO — first purchased, first sold. Never based on current market value."
      />

      {!ruleSetLookup.available ? (
        <EmptyState
          icon={<AlertTriangle aria-hidden="true" className="size-6" />}
          title="Unavailable for this financial year"
          description={`No versioned capital-gains rule set is published for ${fy.label} yet.`}
        />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            Rule set {ruleSetLookup.ruleSet.ruleSetVersion} · status{" "}
            {capitalGains!.report.status}
            {capitalGains!.unclassifiedHoldingCount > 0
              ? ` · ${capitalGains!.unclassifiedHoldingCount} holding(s) not yet classified, excluded below`
              : ""}
            {capitalGains!.mixedCurrencyHoldingCount > 0
              ? ` · ${capitalGains!.mixedCurrencyHoldingCount} holding(s) excluded — activities recorded in more than one currency, unavailable rather than guessed`
              : ""}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col gap-1 p-4 pt-4">
                <p className="text-sm text-muted-foreground">Total gains</p>
                <AmountDisplay value={capitalGains!.report.totalGains} size="lg" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4 pt-4">
                <p className="text-sm text-muted-foreground">Total losses</p>
                <AmountDisplay value={capitalGains!.report.totalLosses} size="lg" />
              </CardContent>
            </Card>
          </div>

          <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
            <SectionHeader id="categories-heading" title="By category" />
            <ul className="flex flex-col gap-2">
              {capitalGains!.report.categoryTotals.map((c) => (
                <li
                  key={c.category}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
                >
                  <span className="font-medium text-foreground">
                    {CATEGORY_LABELS[c.category]}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    Gain {c.grossGain.toString()} · Loss {c.grossLoss.toString()} ·{" "}
                    Net <AmountDisplay value={c.netAmount} size="sm" />
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Categories are never netted against each other here — combined
              set-off calculation is not implemented, so this shows gross
              category totals only.
            </p>
          </section>

          <section
            aria-labelledby="ltcg-exemption-heading"
            className="rounded-lg border border-border bg-surface p-4 text-sm"
          >
            <SectionHeader id="ltcg-exemption-heading" title="Section 112A LTCG exemption" />
            <p className="mt-2 text-muted-foreground">
              Exemption applied (combined listed equity + equity MF):{" "}
              {capitalGains!.report.ltcgExemptionApplied.toString()}. Taxable
              LTCG after exemption:{" "}
              {capitalGains!.report.ltcgTaxableAfterExemption.toString()}.
              Estimated LTCG tax: {capitalGains!.report.ltcgSpecialRateTax.toString()}.
              Estimated STCG tax: {capitalGains!.report.stcgSpecialRateTax.toString()}.
            </p>
          </section>

          <section aria-labelledby="lines-heading" className="flex flex-col gap-3">
            <SectionHeader id="lines-heading" title="Disposal lines" />
            {capitalGains!.report.lines.length === 0 ? (
              <EmptyState
                title="No disposals this financial year"
                description="Classified holdings with a sale in this financial year will appear here."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {capitalGains!.report.lines.map((line) => (
                  <li
                    key={`${line.disposalActivityId}-${line.lotId}`}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-foreground">
                        {line.displayName}
                        {line.isinOrSymbol ? ` (${line.isinOrSymbol})` : ""}
                      </span>
                      <AmountDisplay value={line.rawGain} variant="signed" size="sm" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {line.term} · acquired {line.acquisitionDate} · disposed{" "}
                      {line.disposalDate} · {line.quantity.toString()} units ·
                      {line.ruleMatched
                        ? ` rate ${line.ratePercent?.toString()}%`
                        : " no rate rule matched — needs review"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {unclassifiedHoldings.length > 0 ? (
        <section
          aria-labelledby="unclassified-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader
            id="unclassified-heading"
            title="Holdings needing classification"
          />
          <p className="text-sm text-muted-foreground">
            These holdings are excluded from the capital-gains report above
            until you classify them.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {unclassifiedHoldings.map((h) => (
              <TaxAssetClassificationForm
                key={h.id}
                investmentAssetId={h.investment_asset_id}
                displayName={h.investment_assets?.display_name ?? "Unknown holding"}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
