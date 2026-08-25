import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { IpoDocumentsPanel } from "@/components/ipo/IpoDocumentsPanel";
import { listAllSourceDocumentChunks } from "@/lib/ai/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getIpoIssueById, listIpoDocuments } from "@/lib/ipo/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IpoDocumentsPageProps = {
  params: Promise<{ ipoId: string }>;
};

export const metadata: Metadata = {
  title: "IPO documents — PENRA Money OS",
};

export default async function IpoDocumentsPage({
  params,
}: Readonly<IpoDocumentsPageProps>) {
  const { ipoId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/ipos/${ipoId}/documents`);
  }

  const supabase = await createSupabaseServerClient();
  const ipo = await getIpoIssueById(supabase, ipoId);
  if (!ipo) {
    notFound();
  }

  const [documents, chunks] = await Promise.all([
    listIpoDocuments(supabase, ipoId),
    listAllSourceDocumentChunks(supabase),
  ]);

  return (
    <IpoDocumentsPanel
      ipoIssueId={ipoId}
      documents={documents}
      chunks={chunks}
    />
  );
}
