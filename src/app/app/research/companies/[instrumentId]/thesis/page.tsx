import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ThesisManager } from "@/components/research/ThesisManager";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getMarketInstrumentById } from "@/lib/market-data/queries";
import {
  getCurrentThesisForInstrument,
  listThesisVersions,
} from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CompanyThesisPageProps = {
  params: Promise<{ instrumentId: string }>;
};

export const metadata: Metadata = {
  title: "Investment thesis — PENRA Money OS",
};

export default async function CompanyThesisPage({
  params,
}: Readonly<CompanyThesisPageProps>) {
  const { instrumentId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/research/companies/${instrumentId}/thesis`);
  }

  const supabase = await createSupabaseServerClient();
  const instrument = await getMarketInstrumentById(supabase, instrumentId);
  if (!instrument || instrument.instrumentKind !== "stock") {
    notFound();
  }

  const thesis = await getCurrentThesisForInstrument(supabase, instrumentId);
  const versions = thesis ? await listThesisVersions(supabase, thesis.id) : [];

  return (
    <ThesisManager
      instrumentId={instrumentId}
      thesis={thesis}
      versions={versions}
    />
  );
}
