import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { IpoResearchNoteForm } from "@/components/ipo/IpoResearchNoteForm";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getIpoIssueById, getIpoResearchNote } from "@/lib/ipo/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IpoResearchPageProps = {
  params: Promise<{ ipoId: string }>;
};

export const metadata: Metadata = {
  title: "IPO research — PENRA Money OS",
};

export default async function IpoResearchPage({
  params,
}: Readonly<IpoResearchPageProps>) {
  const { ipoId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/ipos/${ipoId}/research`);
  }

  const supabase = await createSupabaseServerClient();
  const ipo = await getIpoIssueById(supabase, ipoId);
  if (!ipo) {
    notFound();
  }

  const note = await getIpoResearchNote(supabase, ipoId);

  return <IpoResearchNoteForm ipoIssueId={ipoId} note={note} />;
}
