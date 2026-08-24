import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WatchlistsManager } from "@/components/research/WatchlistsManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listAllWatchlistItems, listWatchlists } from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Watchlists — PENRA Money OS",
};

export default async function WatchlistsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/watchlists");
  }

  const supabase = await createSupabaseServerClient();
  const [watchlists, items] = await Promise.all([
    listWatchlists(supabase),
    listAllWatchlistItems(supabase),
  ]);

  const itemCounts: Record<string, number> = {};
  for (const item of items) {
    itemCounts[item.watchlistId] = (itemCounts[item.watchlistId] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Watchlists"
        description="Private lists of companies you're researching. Adding a company here is never the same as owning it — see Investments for actual holdings."
      />
      <WatchlistsManager watchlists={watchlists} itemCounts={itemCounts} />
    </div>
  );
}
