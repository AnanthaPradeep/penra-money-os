import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { IposPageClient } from "@/components/ipo/IposPageClient";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listIpoIssues, listIpoWatchlistItems } from "@/lib/ipo/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "IPOs — PENRA Money OS",
};

export default async function IposPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/ipos");
  }

  const supabase = await createSupabaseServerClient();
  const [ipos, watchlistItems] = await Promise.all([
    listIpoIssues(supabase),
    listIpoWatchlistItems(supabase),
  ]);

  return <IposPageClient ipos={ipos} watchlistItems={watchlistItems} />;
}
