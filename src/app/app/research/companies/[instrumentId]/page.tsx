import { AlertTriangle, Briefcase } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CompanyRatiosPanel } from "@/components/research/CompanyRatiosPanel";
import { FilingsList } from "@/components/research/FilingsList";
import {
  RESEARCH_STATUS_VARIANTS,
  THESIS_STATUS_VARIANTS,
} from "@/components/research/statusVariants";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { listInvestmentAssets } from "@/lib/investments/queries";
import {
  getMarketInstrumentById,
  getPriceHistoryForInstrument,
} from "@/lib/market-data/queries";
import {
  getCompanyProfile,
  getCurrentThesisForInstrument,
  getResearchReviewReminders,
  listCompanyFilingsForInstrument,
  listCompanyFinancialMetricsForPeriods,
  listCompanyFinancialPeriods,
  listResearchNotesForInstrument,
  listAllWatchlistItems,
  listWatchlists,
} from "@/lib/research/queries";
import {
  buildMetricLookup,
  getLatestPeriod,
  getMetricValue,
  getPriorPeriod,
} from "@/lib/research/statements";
import {
  RESEARCH_STATUS_LABELS,
  THESIS_STATUS_LABELS,
} from "@/lib/research/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CompanyOverviewPageProps = {
  params: Promise<{ instrumentId: string }>;
};

export const metadata: Metadata = {
  title: "Company research — PENRA Money OS",
};

export default async function CompanyOverviewPage({
  params,
}: Readonly<CompanyOverviewPageProps>) {
  const { instrumentId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/research/companies/${instrumentId}`);
  }

  const supabase = await createSupabaseServerClient();
  const instrument = await getMarketInstrumentById(supabase, instrumentId);
  if (!instrument || instrument.instrumentKind !== "stock") {
    notFound();
  }

  const [
    profile,
    periods,
    priceHistory,
    filings,
    notes,
    thesis,
    investmentAssets,
    watchlists,
    watchlistItems,
    reminders,
  ] = await Promise.all([
    getCompanyProfile(supabase, instrumentId),
    listCompanyFinancialPeriods(supabase, instrumentId),
    getPriceHistoryForInstrument(supabase, instrumentId),
    listCompanyFilingsForInstrument(supabase, instrumentId),
    listResearchNotesForInstrument(supabase, instrumentId),
    getCurrentThesisForInstrument(supabase, instrumentId),
    listInvestmentAssets(supabase),
    listWatchlists(supabase),
    listAllWatchlistItems(supabase),
    getResearchReviewReminders(supabase),
  ]);

  const latestAnnual = getLatestPeriod(periods, "annual");
  const priorAnnual = latestAnnual
    ? getPriorPeriod(periods, latestAnnual)
    : null;
  const periodIds = periods.map((p) => p.id);
  const metrics = await listCompanyFinancialMetricsForPeriods(
    supabase,
    periodIds,
  );
  const lookup = buildMetricLookup(metrics);

  const isOwned = investmentAssets.some(
    (a) => a.status === "active" && a.marketInstrumentId === instrumentId,
  );
  const watchlistsById = new Map(watchlists.map((w) => [w.id, w]));
  const itemsForCompany = watchlistItems.filter(
    (item) => item.instrumentId === instrumentId,
  );
  const companyReminders = reminders.filter(
    (r) => r.instrumentId === instrumentId,
  );

  const latestPrice = priceHistory.at(-1) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-2">
        {isOwned ? (
          <Badge variant="positive">
            <Briefcase aria-hidden="true" className="size-3" />
            You own this
          </Badge>
        ) : null}
        {itemsForCompany.map((item) => {
          const list = watchlistsById.get(item.watchlistId);
          if (!list) {
            return null;
          }
          return (
            <Link key={item.id} href={`/app/watchlists/${list.id}`}>
              <Badge variant={RESEARCH_STATUS_VARIANTS[item.researchStatus]}>
                {list.name} · {RESEARCH_STATUS_LABELS[item.researchStatus]}
              </Badge>
            </Link>
          );
        })}
        {thesis ? (
          <Link href={`/app/research/companies/${instrumentId}/thesis`}>
            <Badge variant={THESIS_STATUS_VARIANTS[thesis.status]}>
              Thesis: {THESIS_STATUS_LABELS[thesis.status]}
            </Badge>
          </Link>
        ) : null}
      </section>

      {companyReminders.length > 0 ? (
        <div className="flex flex-col gap-2">
          {companyReminders.map((reminder, index) => (
            <div
              key={`${reminder.reminderType}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning"
            >
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
              {reminder.title ?? "Review due"}
              {reminder.dueDate ? ` — ${reminder.dueDate}` : ""}
            </div>
          ))}
        </div>
      ) : null}

      <section
        aria-labelledby="profile-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="profile-heading" title="Company profile" />
        {profile ? (
          <Card>
            <CardContent className="p-4 text-sm">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Country</dt>
                  <dd className="text-foreground">{profile.country ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sector / industry</dt>
                  <dd className="text-foreground">
                    {[profile.sector, profile.industry]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="text-foreground">
                    {profile.website ? (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-primary hover:underline"
                      >
                        {profile.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="text-foreground">
                    {profile.provider} · received{" "}
                    {formatIstDateTime(profile.receivedAt)}
                  </dd>
                </div>
              </dl>
              {profile.description ? (
                <p className="mt-2 text-muted-foreground">
                  {profile.description}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No provider profile available for this company yet. This is
              expected while the fundamentals provider is not configured, or
              before its first successful refresh — private research below
              (notes, thesis, filings) works regardless.
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="price-heading" className="flex flex-col gap-3">
        <SectionHeader id="price-heading" title="Latest stored price" />
        {latestPrice ? (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              {latestPrice.currency === "INR" ? (
                <AmountDisplay value={latestPrice.price} size="lg" />
              ) : (
                <span className="text-xl font-semibold tabular-nums text-foreground">
                  {latestPrice.currency}{" "}
                  {latestPrice.price.toDecimalPlaces(2).toString()}
                </span>
              )}
              <p className="text-xs text-muted-foreground">
                {latestPrice.currency} · as of {latestPrice.effectiveDate} ·{" "}
                {latestPrice.provider} — end-of-day/delayed data, never a live
                feed.
              </p>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            No stored price yet for this company.
          </p>
        )}
      </section>

      <section
        aria-labelledby="summary-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="summary-heading"
          title="Latest annual snapshot"
          actions={
            <Link
              href={`/app/research/companies/${instrumentId}/financials`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Full financials
            </Link>
          }
        />
        {latestAnnual ? (
          <Card>
            <CardContent className="p-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                {(
                  [
                    ["revenue", "Revenue"],
                    ["net_income", "Net income"],
                    ["total_assets", "Total assets"],
                    ["shareholder_equity", "Shareholder equity"],
                  ] as const
                ).map(([key, label]) => {
                  const value = getMetricValue(lookup, latestAnnual.id, key);
                  return (
                    <div key={key}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium text-foreground">
                        {value ? (
                          <AmountDisplay value={value} size="sm" />
                        ) : (
                          "Unavailable"
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Fiscal year end {latestAnnual.fiscalPeriodEnd} ·{" "}
                {latestAnnual.statementBasis} · {latestAnnual.provider}
              </p>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            No annual statement data available for this company yet.
          </p>
        )}
      </section>

      <section aria-labelledby="ratios-heading" className="flex flex-col gap-3">
        <SectionHeader id="ratios-heading" title="Ratios" />
        <CompanyRatiosPanel
          lookup={lookup}
          latestPeriodId={latestAnnual?.id ?? null}
          priorPeriodId={priorAnnual?.id ?? null}
          latestPrice={
            latestPrice
              ? { value: latestPrice.price, currency: latestPrice.currency }
              : null
          }
          statementCurrency={latestAnnual?.currency ?? null}
          allMetrics={metrics}
        />
      </section>

      <section
        aria-labelledby="filings-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="filings-heading" title="Filings & source links" />
        <FilingsList instrumentId={instrumentId} filings={filings} />
      </section>

      <section
        aria-labelledby="notes-preview-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="notes-preview-heading"
          title="Recent notes"
          actions={
            <Link
              href={`/app/research/companies/${instrumentId}/notes`}
              className="text-sm font-medium text-primary hover:underline"
            >
              All notes
            </Link>
          }
        />
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.slice(0, 2).map((note) => (
              <li key={note.id}>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-3">
                    <p className="text-sm font-medium text-foreground">
                      {note.title}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {note.body}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
