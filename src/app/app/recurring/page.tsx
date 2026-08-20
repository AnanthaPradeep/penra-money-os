import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { OccurrenceRow } from "@/components/recurring/OccurrenceRow";
import { RecurringItemsFilterList } from "@/components/recurring/RecurringItemsFilterList";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";
import { Decimal } from "@/lib/money/decimal";
import { listPayees } from "@/lib/payees/queries";
import {
  getSubscriptionCostSummary,
  listLinkableTransactions,
  listOccurrencesWithItems,
  listRecurringItems,
  listUpcomingCommitments,
} from "@/lib/recurring/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Recurring — PENRA Money OS",
};

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function RecurringOverviewPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/recurring");
  }

  const supabase = await createSupabaseServerClient();
  const today = nowAsIstCalendarDate();
  const within30Days = addDays(today, 30);

  const [
    items,
    dueOccurrences,
    overdueOccurrences,
    failedOccurrences,
    upcomingOccurrences,
    subscriptionCosts,
    accountsWithBalances,
    incomeCategoriesRaw,
    expenseCategoriesRaw,
    payeesRaw,
    linkableExpense,
    linkableIncome,
    linkableTransfer,
  ] = await Promise.all([
    listRecurringItems(supabase),
    listOccurrencesWithItems(supabase, "due"),
    listOccurrencesWithItems(supabase, "overdue"),
    listOccurrencesWithItems(supabase, "failed"),
    listUpcomingCommitments(supabase, within30Days),
    getSubscriptionCostSummary(supabase),
    listAccountsWithBalances(supabase),
    listCategories(supabase, "income"),
    listCategories(supabase, "expense"),
    listPayees(supabase),
    listLinkableTransactions(supabase, "bill"),
    listLinkableTransactions(supabase, "income"),
    listLinkableTransactions(supabase, "transfer"),
  ]);

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const accounts = accountsWithBalances
    .filter((a) => !a.isArchived)
    .map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      displayBalance: a.displayBalance.toString(),
    }));
  const incomeCategories = incomeCategoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const expenseCategories = expenseCategoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const payees = payeesRaw.map((p) => ({ id: p.id, name: p.name }));

  const needsAttention = [
    ...overdueOccurrences,
    ...dueOccurrences,
    ...failedOccurrences,
  ];
  // listUpcomingCommitments deliberately includes due/overdue/failed too (a
  // broader "what's coming due" window) — the money total below counts all
  // of that, but the "Upcoming" list section only shows the ones not
  // already shown in "Needs attention", to avoid rendering the same
  // occurrence twice.
  const upcomingOnly = upcomingOccurrences.filter(
    (o) => o.status === "upcoming",
  );
  const dueWithinSevenDays = upcomingOccurrences.filter(
    (o) => o.scheduledDate <= addDays(today, 7),
  );
  const totalDueSoon = dueWithinSevenDays.reduce(
    (sum, o) => sum.plus(o.amount),
    new Decimal(0),
  );

  function linkablesFor(kind: string) {
    if (kind === "income") return linkableIncome;
    if (kind === "transfer") return linkableTransfer;
    return linkableExpense;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Recurring"
        description="Subscriptions, bills, recurring income, and recurring transfers."
        actions={
          <Button asChild>
            <Link href="/app/recurring/new">
              <PlusCircle aria-hidden="true" className="size-4" />
              New recurring item
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Subscriptions / month
            </p>
            <AmountDisplay
              value={subscriptionCosts.monthlyEstimate}
              size="lg"
            />
            <p className="text-xs text-muted-foreground">
              ~{subscriptionCosts.annualEstimate.toFixed(0)} / year &middot;
              estimate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Due in next 7 days</p>
            <AmountDisplay value={totalDueSoon} size="lg" />
            <p className="text-xs text-muted-foreground">
              {dueWithinSevenDays.length}{" "}
              {dueWithinSevenDays.length === 1 ? "occurrence" : "occurrences"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Needs attention</p>
            <p className="text-3xl font-semibold text-foreground">
              {needsAttention.length}
            </p>
            <p className="text-xs text-muted-foreground">
              due, overdue, or failed
            </p>
          </CardContent>
        </Card>
      </div>

      <section
        aria-labelledby="attention-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="attention-heading" title="Needs attention" />
        {needsAttention.length === 0 ? (
          <EmptyState
            title="Nothing needs attention"
            description="Due, overdue, and failed occurrences will show up here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {needsAttention.map((occurrence) => (
              <li key={occurrence.id}>
                <OccurrenceRow
                  occurrence={occurrence}
                  item={itemsById.get(occurrence.recurringItemId)}
                  accounts={accounts}
                  incomeCategories={incomeCategories}
                  expenseCategories={expenseCategories}
                  payees={payees}
                  linkableTransactions={linkablesFor(occurrence.itemKind)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="upcoming-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="upcoming-heading" title="Upcoming (next 30 days)" />
        {upcomingOnly.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled in the next 30 days.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcomingOnly.map((occurrence) => (
              <li key={occurrence.id}>
                <OccurrenceRow
                  occurrence={occurrence}
                  item={itemsById.get(occurrence.recurringItemId)}
                  accounts={accounts}
                  incomeCategories={incomeCategories}
                  expenseCategories={expenseCategories}
                  payees={payees}
                  linkableTransactions={linkablesFor(occurrence.itemKind)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="all-items-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="all-items-heading" title="All recurring items" />
        {items.length === 0 ? (
          <EmptyState
            title="No recurring items yet"
            description="Create a subscription, bill, recurring income, or recurring transfer."
            action={
              <Button asChild>
                <Link href="/app/recurring/new">
                  <PlusCircle aria-hidden="true" className="size-4" />
                  New recurring item
                </Link>
              </Button>
            }
          />
        ) : (
          <RecurringItemsFilterList items={items} />
        )}
      </section>
    </div>
  );
}
