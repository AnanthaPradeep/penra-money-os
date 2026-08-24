import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AddWatchlistItemPanel } from "@/components/research/AddWatchlistItemPanel";
import { EditWatchlistDialog } from "@/components/research/EditWatchlistDialog";
import { WatchlistItemRow } from "@/components/research/WatchlistItemRow";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listInvestmentAssets } from "@/lib/investments/queries";
import { listMarketInstrumentsByIds } from "@/lib/market-data/queries";
import { getWatchlistById, listWatchlistItems } from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WatchlistDetailPageProps = {
  params: Promise<{ watchlistId: string }>;
};

export const metadata: Metadata = {
  title: "Watchlist — PENRA Money OS",
};

export default async function WatchlistDetailPage({
  params,
}: Readonly<WatchlistDetailPageProps>) {
  const { watchlistId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/watchlists/${watchlistId}`);
  }

  const supabase = await createSupabaseServerClient();
  const watchlist = await getWatchlistById(supabase, watchlistId);
  if (!watchlist) {
    notFound();
  }

  const [items, investmentAssets] = await Promise.all([
    listWatchlistItems(supabase, watchlistId),
    listInvestmentAssets(supabase),
  ]);
  const instrumentIds = items.map((item) => item.instrumentId);
  const instruments = await listMarketInstrumentsByIds(supabase, instrumentIds);
  const instrumentsById = new Map(instruments.map((i) => [i.id, i]));

  const ownedInstrumentIds = new Set(
    investmentAssets
      .filter((a) => a.status === "active" && a.marketInstrumentId)
      .map((a) => a.marketInstrumentId as string),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<BackLink href="/app/watchlists">All watchlists</BackLink>}
        title={watchlist.name}
        {...(watchlist.description
          ? { description: watchlist.description }
          : {})}
        actions={<EditWatchlistDialog watchlist={watchlist} />}
      />

      <section
        aria-labelledby="add-company-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="add-company-heading" title="Add a company" />
        <AddWatchlistItemPanel
          watchlistId={watchlist.id}
          existingInstrumentIds={instrumentIds}
        />
      </section>

      <section
        aria-labelledby="companies-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="companies-heading"
          title={`${items.length} ${items.length === 1 ? "company" : "companies"}`}
        />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No companies on this watchlist yet — search above to add one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <WatchlistItemRow
                  item={item}
                  instrument={instrumentsById.get(item.instrumentId) ?? null}
                  isOwned={ownedInstrumentIds.has(item.instrumentId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
