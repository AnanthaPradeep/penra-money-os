import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AiJobsList } from "@/components/ai/AiJobsList";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAiJobs } from "@/lib/ai/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI requests — PENRA Money OS",
};

export default async function AiJobsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/research/ai-jobs");
  }

  const supabase = await createSupabaseServerClient();
  const jobs = await listAiJobs(supabase);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI requests"
        description="Every AI generation this app has run for you — audited, capped, and never applied to your research or ledger without your review."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/app/settings/ai"
              className="text-sm font-medium text-primary hover:underline"
            >
              AI settings
            </Link>
            <Link href="/app/research/assistant">
              <Button size="sm">New request</Button>
            </Link>
          </div>
        }
      />
      <AiJobsList jobs={jobs} />
    </div>
  );
}
