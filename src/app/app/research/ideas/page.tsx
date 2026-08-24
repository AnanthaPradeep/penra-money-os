import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { IdeasManager } from "@/components/research/IdeasManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listMarketInstrumentsByIds } from "@/lib/market-data/queries";
import { listInvestmentIdeas } from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Investment ideas — PENRA Money OS",
};

export default async function IdeasPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/research/ideas");
  }

  const supabase = await createSupabaseServerClient();
  const ideas = await listInvestmentIdeas(supabase);
  const instruments = await listMarketInstrumentsByIds(
    supabase,
    ideas.map((i) => i.instrumentId),
  );
  const instrumentsById = Object.fromEntries(instruments.map((i) => [i.id, i]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Investment ideas"
        description="Personal research records for opportunities you're tracking — capturing, approving, or closing an idea here never places a trade or creates a holding."
      />
      <IdeasManager ideas={ideas} instrumentsById={instrumentsById} />
    </div>
  );
}
