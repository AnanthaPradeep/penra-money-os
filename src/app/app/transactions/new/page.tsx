import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NewTransactionForm } from "@/components/ledger/NewTransactionForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New transaction — PENRA Money OS",
};

type NewTransactionPageProps = {
  searchParams: Promise<{ account?: string }>;
};

export default async function NewTransactionPage({
  searchParams,
}: Readonly<NewTransactionPageProps>) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/transactions/new");
  }

  const { account } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const accountsWithBalances = await listAccountsWithBalances(supabase);

  // displayBalance is a Decimal (a class instance) and cannot cross the
  // Server -> Client Component prop boundary — convert to a plain string
  // here, once, rather than in every downstream form component.
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
        eyebrow={<BackLink href="/app/accounts">Back to accounts</BackLink>}
        title="New transaction"
      />

      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You need at least one account before you can record a transaction.{" "}
          <Link
            href="/app/accounts/new"
            className="font-medium text-primary hover:underline"
          >
            Create an account
          </Link>
          .
        </p>
      ) : (
        <NewTransactionForm
          accounts={accounts}
          defaultAccountId={account}
          defaultDate={nowAsIstCalendarDate()}
        />
      )}
    </div>
  );
}
