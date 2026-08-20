import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TransactionFiltersForm } from "@/components/ledger/TransactionFiltersForm";
import { TransactionListRow } from "@/components/ledger/TransactionListRow";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import { transactionFiltersSearchParamsSchema } from "@/lib/ledger/filters-schema";
import { listTransactionsForUser } from "@/lib/ledger/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Transactions — PENRA Money OS",
};

const PAGE_SIZE = 25;

type TransactionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TransactionsPage({
  searchParams,
}: Readonly<TransactionsPageProps>) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/transactions");
  }

  const rawParams = await searchParams;
  const parsed = transactionFiltersSearchParamsSchema.safeParse({
    q: firstValue(rawParams.q),
    kind: firstValue(rawParams.kind),
    account: firstValue(rawParams.account),
    category: firstValue(rawParams.category),
    status: firstValue(rawParams.status),
    from: firstValue(rawParams.from),
    to: firstValue(rawParams.to),
    min: firstValue(rawParams.min),
    max: firstValue(rawParams.max),
    page: firstValue(rawParams.page),
  });

  // An invalid/malformed query string is never a page error — it just
  // falls back to the unfiltered first page, exactly like an empty one.
  const filters = parsed.success
    ? parsed.data
    : transactionFiltersSearchParamsSchema.parse({});

  const supabase = await createSupabaseServerClient();
  const [accounts, incomeCategories, expenseCategories, result] =
    await Promise.all([
      listAccountsWithBalances(supabase),
      listCategories(supabase, "income"),
      listCategories(supabase, "expense"),
      listTransactionsForUser(supabase, {
        page: filters.page - 1,
        pageSize: PAGE_SIZE,
        search: filters.q,
        kind: filters.kind,
        accountId: filters.account,
        categoryId: filters.category,
        status: filters.status,
        dateFrom: filters.from,
        dateTo: filters.to,
        minAmount: filters.min,
        maxAmount: filters.max,
      }),
    ]);

  const hasActiveFilters = Boolean(
    filters.q ??
    filters.kind ??
    filters.account ??
    filters.category ??
    filters.status ??
    filters.from ??
    filters.to ??
    filters.min ??
    filters.max,
  );

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app">Back to home</BackLink>}
        title="Transactions"
        description={`${result.totalCount} transaction${result.totalCount === 1 ? "" : "s"}`}
      />

      <TransactionFiltersForm
        accounts={accounts
          .filter((a) => !a.isArchived)
          .map((a) => ({ id: a.id, name: a.name }))}
        categories={[...incomeCategories, ...expenseCategories].map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        current={filters}
      />

      {result.items.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? "No transactions match these filters"
              : "No transactions yet"
          }
          description={
            hasActiveFilters
              ? "Try widening your search or clearing a filter."
              : "Transactions you record will show up here."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {result.items.map((item) => (
            <TransactionListRow key={item.transaction.id} item={item} />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Transaction history pages"
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="text-muted-foreground">
            Page {filters.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <PageLink
              searchParams={rawParams}
              page={filters.page - 1}
              disabled={filters.page <= 1}
            >
              Previous
            </PageLink>
            <PageLink
              searchParams={rawParams}
              page={filters.page + 1}
              disabled={filters.page >= totalPages}
            >
              Next
            </PageLink>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function buildPageHref(
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page") continue;
    const single = firstValue(value);
    if (single) {
      params.set(key, single);
    }
  }
  params.set("page", String(page));
  return `/app/transactions?${params.toString()}`;
}

function PageLink({
  searchParams,
  page,
  disabled,
  children,
}: Readonly<{
  searchParams: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  children: string;
}>) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-muted-foreground opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={buildPageHref(searchParams, page)}
      className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted-surface"
    >
      {children}
    </Link>
  );
}
