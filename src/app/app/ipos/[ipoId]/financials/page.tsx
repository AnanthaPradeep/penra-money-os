import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { IpoFinancialsPanel } from "@/components/ipo/IpoFinancialsPanel";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getIpoIssueById,
  listIpoDocuments,
  listIpoFinancialMetrics,
} from "@/lib/ipo/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IpoFinancialsPageProps = {
  params: Promise<{ ipoId: string }>;
};

export const metadata: Metadata = {
  title: "IPO financials — PENRA Money OS",
};

export default async function IpoFinancialsPage({
  params,
}: Readonly<IpoFinancialsPageProps>) {
  const { ipoId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/ipos/${ipoId}/financials`);
  }

  const supabase = await createSupabaseServerClient();
  const ipo = await getIpoIssueById(supabase, ipoId);
  if (!ipo) {
    notFound();
  }

  const [metrics, documents] = await Promise.all([
    listIpoFinancialMetrics(supabase, ipoId),
    listIpoDocuments(supabase, ipoId),
  ]);

  return (
    <IpoFinancialsPanel
      ipoIssueId={ipoId}
      metrics={metrics}
      documents={documents}
    />
  );
}
