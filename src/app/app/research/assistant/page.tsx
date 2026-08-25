import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AiAssistantForm } from "@/components/ai/AiAssistantForm";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  listAllSourceDocumentChunks,
  listAiProviderModels,
} from "@/lib/ai/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listIpoIssues, listIpoWatchlistItems } from "@/lib/ipo/queries";
import { listInvestmentAssets } from "@/lib/investments/queries";
import { listMarketInstrumentsByIds } from "@/lib/market-data/queries";
import { listAllWatchlistItems } from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Research assistant — PENRA Money OS",
};

export default async function ResearchAssistantPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/research/assistant");
  }

  const supabase = await createSupabaseServerClient();
  const [
    investmentAssets,
    watchlistItems,
    ipoWatchlistItems,
    ipos,
    models,
    chunks,
  ] = await Promise.all([
    listInvestmentAssets(supabase),
    listAllWatchlistItems(supabase),
    listIpoWatchlistItems(supabase),
    listIpoIssues(supabase),
    listAiProviderModels(supabase),
    listAllSourceDocumentChunks(supabase),
  ]);

  const companyInstrumentIds = [
    ...new Set(
      [
        ...investmentAssets
          .filter((a) => a.status === "active" && a.marketInstrumentId)
          .map((a) => a.marketInstrumentId as string),
        ...watchlistItems.map((w) => w.instrumentId),
      ].filter(Boolean),
    ),
  ];
  const companyInstruments = await listMarketInstrumentsByIds(
    supabase,
    companyInstrumentIds,
  );
  const companies = companyInstruments.map((i) => ({ id: i.id, name: i.name }));

  const watchedIpoIds = new Set(ipoWatchlistItems.map((w) => w.ipoIssueId));
  const watchedIpos = ipos
    .filter((ipo) => watchedIpoIds.has(ipo.id))
    .map((ipo) => ({ id: ipo.id, name: ipo.issuerName }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Research assistant"
        description="Ask a bounded question against your own transcribed source excerpts. It answers from those sources only, cites every claim, and never recommends buying, selling, or predicts a price."
      />
      <AiAssistantForm
        companies={companies}
        ipos={watchedIpos}
        models={models}
        chunks={chunks}
      />
    </div>
  );
}
