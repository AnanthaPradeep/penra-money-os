import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OccurrenceActionsCell } from "@/components/recurring/OccurrenceActionsCell";
import { RecurringItemActions } from "@/components/recurring/RecurringItemActions";
import { RecurringItemEditForm } from "@/components/recurring/RecurringItemEditForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { listPayees } from "@/lib/payees/queries";
import {
  getRecurringItemById,
  listLinkableTransactions,
  listOccurrencesForItem,
} from "@/lib/recurring/queries";
import { RECURRING_ITEM_KIND_LABELS } from "@/lib/recurring/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RecurringItemDetailPageProps = {
  params: Promise<{ recurringItemId: string }>;
  searchParams: Promise<{ created?: string }>;
};

export const metadata: Metadata = {
  title: "Recurring item — PENRA Money OS",
};

function formatCalendarDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(new Date(`${isoDate}T00:00:00+05:30`));
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
};

export default async function RecurringItemDetailPage({
  params,
  searchParams,
}: Readonly<RecurringItemDetailPageProps>) {
  const { recurringItemId } = await params;
  const { created } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/recurring/${recurringItemId}`);
  }

  const supabase = await createSupabaseServerClient();
  const item = await getRecurringItemById(supabase, recurringItemId);

  if (!item) {
    notFound();
  }

  const [
    history,
    accountsWithBalances,
    incomeCategoriesRaw,
    expenseCategoriesRaw,
    payeesRaw,
    linkableTransactions,
  ] = await Promise.all([
    listOccurrencesForItem(supabase, recurringItemId),
    listAccountsWithBalances(supabase),
    listCategories(supabase, "income"),
    listCategories(supabase, "expense"),
    listPayees(supabase),
    listLinkableTransactions(supabase, item.kind),
  ]);

  const accounts = accountsWithBalances.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    displayBalance: a.displayBalance.toString(),
  }));
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const incomeCategories = incomeCategoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const expenseCategories = expenseCategoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const categoriesForKind =
    item.kind === "transfer"
      ? null
      : item.kind === "income"
        ? incomeCategories
        : expenseCategories;
  const payees = payeesRaw.map((p) => ({ id: p.id, name: p.name }));
  const categoryName = item.categoryId
    ? (categoriesForKind ?? []).find((c) => c.id === item.categoryId)?.name
    : undefined;
  const payeeName = item.payeeId
    ? payees.find((p) => p.id === item.payeeId)?.name
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {created === "1" ? (
        <ToastOnParam param="created" message="Recurring item created." />
      ) : null}

      <PageHeader
        eyebrow={<BackLink href="/app/recurring">Back to recurring</BackLink>}
        title={item.name}
        description={`${RECURRING_ITEM_KIND_LABELS[item.kind]} · ${FREQUENCY_LABELS[item.frequency] ?? item.frequency}`}
        actions={<StatusBadge status={item.status} />}
      />

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <AmountDisplay value={item.amount} size="xl" />
        <div className="flex gap-3">
          <RecurringItemEditForm
            item={item}
            categories={categoriesForKind}
            payees={payees}
            defaultPayee={
              payeeName && item.payeeId
                ? { id: item.payeeId, name: payeeName }
                : undefined
            }
          />
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border bg-surface p-5 text-sm sm:grid-cols-2">
        {item.kind === "transfer" ? (
          <>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">From</dt>
              <dd className="font-medium text-foreground">
                {accountsById.get(item.sourceAccountId ?? "")?.name ?? "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">To</dt>
              <dd className="font-medium text-foreground">
                {accountsById.get(item.destinationAccountId ?? "")?.name ?? "—"}
              </dd>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">
              {item.kind === "income" ? "Received into" : "Paid from"}
            </dt>
            <dd className="font-medium text-foreground">
              {accountsById.get(
                item.sourceAccountId ?? item.destinationAccountId ?? "",
              )?.name ?? "—"}
            </dd>
          </div>
        )}
        {categoryName ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-medium text-foreground">{categoryName}</dd>
          </div>
        ) : null}
        {payeeName ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">
              {item.kind === "income" ? "Payer" : "Payee"}
            </dt>
            <dd className="font-medium text-foreground">{payeeName}</dd>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Started</dt>
          <dd className="font-medium text-foreground">
            {formatCalendarDate(item.startDate)}
          </dd>
        </div>
        {item.endDate ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Ends</dt>
            <dd className="font-medium text-foreground">
              {formatCalendarDate(item.endDate)}
            </dd>
          </div>
        ) : null}
        {item.nextDueDate ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Next due</dt>
            <dd className="font-medium text-foreground">
              {formatCalendarDate(item.nextDueDate)}
            </dd>
          </div>
        ) : null}
        {item.trialEndDate ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Trial ends</dt>
            <dd className="font-medium text-foreground">
              {formatCalendarDate(item.trialEndDate)}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Handling</dt>
          <dd className="font-medium text-foreground">
            {item.processingMode === "auto_post"
              ? "Posts automatically"
              : "Reminder only"}
          </dd>
        </div>
      </dl>

      {item.notes ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm whitespace-pre-wrap text-muted-foreground">
          {item.notes}
        </p>
      ) : null}

      <RecurringItemActions recurringItemId={item.id} status={item.status} />

      <section
        aria-labelledby="history-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="history-heading" title="Occurrence history" />
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No occurrences generated yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((occurrence) => (
              <li
                key={occurrence.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {formatCalendarDate(occurrence.scheduledDate)}
                  </span>
                  <div className="flex items-center gap-3">
                    <AmountDisplay value={occurrence.amount} size="sm" />
                    <StatusBadge status={occurrence.status} />
                  </div>
                </div>
                {occurrence.linkedTransactionId ? (
                  <Link
                    href={`/app/transactions/${occurrence.linkedTransactionId}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View linked transaction
                  </Link>
                ) : null}
                {occurrence.failureReason ? (
                  <p className="text-xs text-negative">
                    {occurrence.failureReason}
                  </p>
                ) : null}
                {occurrence.processedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Processed {formatIstDateTime(occurrence.processedAt)}
                  </p>
                ) : null}
                <OccurrenceActionsCell
                  occurrence={{
                    ...occurrence,
                    itemName: item.name,
                    itemKind: item.kind,
                    processingMode: item.processingMode,
                  }}
                  item={item}
                  accounts={accounts}
                  incomeCategories={incomeCategories}
                  expenseCategories={expenseCategories}
                  payees={payees}
                  linkableTransactions={linkableTransactions}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
