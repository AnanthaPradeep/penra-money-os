import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { getMarketDataProviderStates } from "@/lib/market-data/queries";
import {
  getResearchReviewReminders,
  listAllTheses,
  listInvestmentIdeas,
  listRecentReviewEvents,
  listWatchlists,
} from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Research — PENRA Money OS",
};

export default async function ResearchHomePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/research");
  }

  const supabase = await createSupabaseServerClient();
  const [watchlists, ideas, theses, reminders, recentEvents, providerStates] =
    await Promise.all([
      listWatchlists(supabase),
      listInvestmentIdeas(supabase),
      listAllTheses(supabase),
      getResearchReviewReminders(supabase),
      listRecentReviewEvents(supabase, 8),
      getMarketDataProviderStates(supabase),
    ]);

  const activeWatchlists = watchlists.filter((w) => w.status === "active");
  const activeIdeas = ideas.filter(
    (i) => i.status !== "closed" && i.status !== "archived",
  );
  const thesesNeedingReview = theses.filter((t) => t.status === "needs_review");
  const overdueReminders = reminders.filter(
    (r) => r.reminderType === "thesis_overdue",
  );
  const fundamentalsProvider = providerStates.find(
    (s) => s.provider === "twelve_data",
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Research"
        description="Watchlists, company fundamentals, investment theses, and ideas — entirely separate from your ledger and portfolio. Nothing here mutates a balance, holding, or transaction."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/app/watchlists">
          <Card className="h-full transition-colors hover:border-input-border">
            <CardContent className="flex flex-col gap-1 p-4">
              <p className="text-sm text-muted-foreground">Watchlists</p>
              <p className="text-2xl font-semibold text-foreground">
                {activeWatchlists.length}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/research/ideas">
          <Card className="h-full transition-colors hover:border-input-border">
            <CardContent className="flex flex-col gap-1 p-4">
              <p className="text-sm text-muted-foreground">Active ideas</p>
              <p className="text-2xl font-semibold text-foreground">
                {activeIdeas.length}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm text-muted-foreground">
              Theses needing review
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {thesesNeedingReview.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm text-muted-foreground">Overdue reviews</p>
            <p className="text-2xl font-semibold text-foreground">
              {overdueReminders.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/app/research/compare"
          className="font-medium text-primary hover:underline"
        >
          Compare companies
        </Link>
        <Link
          href="/app/ipos"
          className="font-medium text-primary hover:underline"
        >
          IPOs
        </Link>
        <Link
          href="/app/events"
          className="font-medium text-primary hover:underline"
        >
          Corporate events
        </Link>
        <Link
          href="/app/research/assistant"
          className="font-medium text-primary hover:underline"
        >
          Ask the research assistant
        </Link>
        <Link
          href="/app/research/ai-jobs"
          className="font-medium text-primary hover:underline"
        >
          AI requests
        </Link>
      </div>

      {fundamentalsProvider ? (
        <div
          className={
            fundamentalsProvider.isConfigured
              ? "flex items-center gap-3 rounded-lg border border-border bg-elevated px-4 py-3 text-sm text-muted-foreground"
              : "flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning"
          }
        >
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          {fundamentalsProvider.isConfigured
            ? `Fundamentals provider (${fundamentalsProvider.provider}) is configured. Last success: ${
                fundamentalsProvider.lastSuccessAt
                  ? formatIstDateTime(fundamentalsProvider.lastSuccessAt)
                  : "never"
              }.`
            : "Fundamentals provider not configured — company profile/financials/ratios stay unavailable until an operator sets the required secret. Watchlists, notes, theses, filings, and ideas work regardless."}
        </div>
      ) : null}

      {thesesNeedingReview.length > 0 ? (
        <section
          aria-labelledby="theses-review-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader
            id="theses-review-heading"
            title="Theses needing review"
          />
          <ul className="flex flex-col gap-2">
            {thesesNeedingReview.map((thesis) => (
              <li key={thesis.id}>
                <Link
                  href={`/app/research/companies/${thesis.instrumentId}/thesis`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning transition-colors hover:border-warning/50"
                >
                  {thesis.title}
                  {thesis.expectedReviewDate
                    ? ` — was due ${thesis.expectedReviewDate}`
                    : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="recent-research-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="recent-research-heading"
          title="Recently updated research"
        />
        {recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No research activity yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
              >
                <span className="flex items-center gap-2 text-foreground">
                  <Badge variant="neutral">{event.eventType}</Badge>
                  {event.summary ?? ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatIstDateTime(event.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
