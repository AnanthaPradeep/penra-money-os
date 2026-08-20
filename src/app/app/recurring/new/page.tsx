import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RecurringItemForm } from "@/components/recurring/RecurringItemForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";
import { listPayees } from "@/lib/payees/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New recurring item — PENRA Money OS",
};

export default async function NewRecurringItemPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/recurring/new");
  }

  const supabase = await createSupabaseServerClient();
  const [accountsWithBalances, incomeCategories, expenseCategories, payees] =
    await Promise.all([
      listAccountsWithBalances(supabase),
      listCategories(supabase, "income"),
      listCategories(supabase, "expense"),
      listPayees(supabase),
    ]);

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
        eyebrow={<BackLink href="/app/recurring">Back to recurring</BackLink>}
        title="New recurring item"
        description="Subscriptions, bills, recurring income, and recurring transfers all live here."
      />

      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You need at least one account before you can create a recurring item.{" "}
          <Link
            href="/app/accounts/new"
            className="font-medium text-primary hover:underline"
          >
            Create an account
          </Link>
          .
        </p>
      ) : (
        <RecurringItemForm
          accounts={accounts}
          incomeCategories={incomeCategories.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          expenseCategories={expenseCategories.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          payees={payees.map((p) => ({ id: p.id, name: p.name }))}
          defaultStartDate={nowAsIstCalendarDate()}
        />
      )}
    </div>
  );
}
