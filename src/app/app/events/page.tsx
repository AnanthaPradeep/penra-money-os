import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EventsList } from "@/components/corporate-events/EventsList";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  listCorporateEventsForInstruments,
  listRecentCorporateEvents,
} from "@/lib/corporate-events/queries";
import { listInvestmentAssets } from "@/lib/investments/queries";
import { listMarketInstrumentsByIds } from "@/lib/market-data/queries";
import { listAllWatchlistItems } from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Corporate events — PENRA Money OS",
};

export default async function EventsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/events");
  }

  const supabase = await createSupabaseServerClient();
  const [investmentAssets, watchlistItems] = await Promise.all([
    listInvestmentAssets(supabase),
    listAllWatchlistItems(supabase),
  ]);

  const heldOrWatchedInstrumentIds = [
    ...new Set(
      [
        ...investmentAssets
          .filter((a) => a.status === "active" && a.marketInstrumentId)
          .map((a) => a.marketInstrumentId as string),
        ...watchlistItems.map((w) => w.instrumentId),
      ].filter(Boolean),
    ),
  ];

  const [relevantEvents, recentEvents] = await Promise.all([
    listCorporateEventsForInstruments(supabase, heldOrWatchedInstrumentIds),
    listRecentCorporateEvents(supabase, 20),
  ]);

  const allInstrumentIds = [
    ...new Set([
      ...relevantEvents.map((e) => e.instrumentId),
      ...recentEvents.map((e) => e.instrumentId),
    ]),
  ];
  const instruments = await listMarketInstrumentsByIds(
    supabase,
    allInstrumentIds,
  );
  const instrumentsById = Object.fromEntries(instruments.map((i) => [i.id, i]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Corporate events"
        description="Dividends, splits, results, and other announcements — sourced from a configured provider, never used to change your ledger or holdings automatically."
      />

      <section
        aria-labelledby="relevant-events-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="relevant-events-heading"
          title="For your holdings & watchlist"
        />
        {heldOrWatchedInstrumentIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Hold or watch a company to see its events here.
          </p>
        ) : (
          <EventsList
            events={relevantEvents}
            instrumentsById={instrumentsById}
          />
        )}
      </section>

      <section
        aria-labelledby="recent-events-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="recent-events-heading" title="Recently received" />
        <EventsList events={recentEvents} instrumentsById={instrumentsById} />
      </section>
    </div>
  );
}
