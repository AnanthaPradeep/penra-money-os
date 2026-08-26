import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ImportWizard } from "@/components/bank-import/ImportWizard";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Import a statement — PENRA Money OS",
};

type NewImportPageProps = {
  searchParams: Promise<{ account?: string }>;
};

export default async function NewImportPage({
  searchParams,
}: Readonly<NewImportPageProps>) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/import/new");
  }

  const { account } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const accountsWithBalances = await listAccountsWithBalances(supabase);
  const accounts = accountsWithBalances
    .filter((a) => !a.isArchived)
    .map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      displayBalance: a.displayBalance.toString(),
    }));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/import">Back to imports</BackLink>}
        title="Import a bank statement"
        description="Upload a CSV or TSV export from your bank or credit card. Nothing posts to your ledger until you review and confirm every row."
      />
      <ImportWizard accounts={accounts} defaultAccountId={account} />
    </div>
  );
}
