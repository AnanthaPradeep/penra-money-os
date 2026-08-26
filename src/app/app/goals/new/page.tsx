import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GoalForm } from "@/components/goals/GoalForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPurposeWallets } from "@/lib/wallets/queries";

export const metadata: Metadata = { title: "New goal — PENRA Money OS" };

export default async function NewGoalPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/goals/new");
  }

  const supabase = await createSupabaseServerClient();
  const wallets = await listPurposeWallets(supabase);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/goals">Back to goals</BackLink>}
        title="New goal"
        description="Set a target amount and, optionally, a target date. Nothing here assumes an investment return or guarantees you'll reach it by any date."
      />
      <GoalForm wallets={wallets.map((w) => ({ id: w.id, name: w.name }))} />
    </div>
  );
}
