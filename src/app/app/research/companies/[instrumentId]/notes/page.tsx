import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { NotesManager } from "@/components/research/NotesManager";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getMarketInstrumentById } from "@/lib/market-data/queries";
import { listResearchNotesForInstrument } from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CompanyNotesPageProps = {
  params: Promise<{ instrumentId: string }>;
};

export const metadata: Metadata = {
  title: "Notes — PENRA Money OS",
};

export default async function CompanyNotesPage({
  params,
}: Readonly<CompanyNotesPageProps>) {
  const { instrumentId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/research/companies/${instrumentId}/notes`);
  }

  const supabase = await createSupabaseServerClient();
  const instrument = await getMarketInstrumentById(supabase, instrumentId);
  if (!instrument || instrument.instrumentKind !== "stock") {
    notFound();
  }

  const notes = await listResearchNotesForInstrument(supabase, instrumentId);

  return <NotesManager instrumentId={instrumentId} notes={notes} />;
}
