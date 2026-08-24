import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { IdeaDetailManager } from "@/components/research/IdeaDetailManager";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getMarketInstrumentById } from "@/lib/market-data/queries";
import {
  getCurrentThesisForInstrument,
  getInvestmentIdeaById,
  getThesisById,
  listReviewEventsForIdea,
} from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IdeaDetailPageProps = {
  params: Promise<{ ideaId: string }>;
};

export const metadata: Metadata = {
  title: "Investment idea — PENRA Money OS",
};

export default async function IdeaDetailPage({
  params,
}: Readonly<IdeaDetailPageProps>) {
  const { ideaId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/research/ideas/${ideaId}`);
  }

  const supabase = await createSupabaseServerClient();
  const idea = await getInvestmentIdeaById(supabase, ideaId);
  if (!idea) {
    notFound();
  }

  const [instrument, linkedThesis, currentThesisForCompany, reviewEvents] =
    await Promise.all([
      getMarketInstrumentById(supabase, idea.instrumentId),
      idea.thesisId ? getThesisById(supabase, idea.thesisId) : null,
      getCurrentThesisForInstrument(supabase, idea.instrumentId),
      listReviewEventsForIdea(supabase, ideaId),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/research/ideas">All ideas</BackLink>}
        title={idea.title}
      />
      <IdeaDetailManager
        idea={idea}
        companyName={instrument?.name ?? "Unknown company"}
        instrumentId={idea.instrumentId}
        linkedThesis={linkedThesis}
        currentThesisForCompany={currentThesisForCompany}
        reviewEvents={reviewEvents}
      />
    </div>
  );
}
