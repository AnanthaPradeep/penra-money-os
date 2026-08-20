import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapLedgerEntryRow,
  mapLedgerTransactionRow,
  type LedgerEntry,
  type LedgerTransaction,
} from "@/lib/ledger/mapping";
import type {
  ManualTransactionType,
  TransactionStatus,
} from "@/lib/ledger/transaction-types";
import { Decimal, type Money } from "@/lib/money/decimal";
import type { Database } from "@/types/database.types";

export type AccountHistoryItem = {
  entry: LedgerEntry;
  transaction: LedgerTransaction;
};

/**
 * Lists the caller's own ledger entries for one account, newest first by
 * the transaction's occurred_at (not the entry's created_at, which is
 * insertion order and can differ for a backdated manual transaction).
 * Sorted in memory rather than via a foreign-table order clause to avoid
 * depending on a specific supabase-js embedded-order parameter name.
 */
export async function listEntriesForAccount(
  supabase: SupabaseClient<Database>,
  accountId: string,
  limit = 50,
): Promise<AccountHistoryItem[]> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*, ledger_transactions(*)")
    .eq("account_id", accountId)
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => ({
      entry: mapLedgerEntryRow(row),
      transaction: mapLedgerTransactionRow(row.ledger_transactions),
    }))
    .sort((a, b) =>
      a.transaction.occurredAt < b.transaction.occurredAt ? 1 : -1,
    );
}

export type TransactionEntryDetail = LedgerEntry & {
  accountName: string;
  accountClass: string;
};

export type TransactionDetail = {
  transaction: LedgerTransaction;
  entries: TransactionEntryDetail[];
  categoryName: string | null;
  payeeName: string | null;
};

/** Reads one of the caller's own transactions together with its entries, each entry's account name, and its category/payee display name. */
export async function getTransactionWithEntries(
  supabase: SupabaseClient<Database>,
  transactionId: string,
): Promise<TransactionDetail | null> {
  const { data: transactionRow, error: transactionError } = await supabase
    .from("ledger_transactions")
    .select("*, categories(name), payees(name)")
    .eq("id", transactionId)
    .maybeSingle();

  if (transactionError || !transactionRow) {
    return null;
  }

  const { data: entryRows, error: entriesError } = await supabase
    .from("ledger_entries")
    .select("*, accounts(name, account_class)")
    .eq("transaction_id", transactionId);

  if (entriesError || !entryRows) {
    return null;
  }

  const { categories, payees, ...transactionFields } = transactionRow;

  return {
    transaction: mapLedgerTransactionRow(transactionFields),
    entries: entryRows.map((row) => ({
      ...mapLedgerEntryRow(row),
      accountName: row.accounts?.name ?? "Unknown account",
      accountClass: row.accounts?.account_class ?? "asset",
    })),
    categoryName: categories?.name ?? null,
    payeeName: payees?.name ?? null,
  };
}

export type RecentActivityItem = {
  transaction: LedgerTransaction;
  /** The entry considered most representative for a one-line summary — the first user-facing (non-system) account touched, since a system account (Uncategorized Income/Expense, Opening Balance Equity) is never shown directly in the UI. */
  primaryEntry: TransactionEntryDetail;
};

/**
 * A short list of the caller's own most recent transactions, for the
 * protected home page's activity feed — real data only, reusing the same
 * RLS-protected tables the rest of the ledger UI already queries, not a
 * new financial feature.
 */
export async function listRecentTransactionsForUser(
  supabase: SupabaseClient<Database>,
  limit = 6,
): Promise<RecentActivityItem[]> {
  const { data, error } = await supabase
    .from("ledger_transactions")
    .select("*, ledger_entries(*, accounts(name, account_class, is_system))")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  const items: RecentActivityItem[] = [];

  for (const row of data) {
    const entryRows = row.ledger_entries;
    const primaryRow =
      entryRows.find((entry) => entry.accounts && !entry.accounts.is_system) ??
      entryRows[0];

    if (!primaryRow) {
      continue;
    }

    items.push({
      transaction: mapLedgerTransactionRow(row),
      primaryEntry: {
        ...mapLedgerEntryRow(primaryRow),
        accountName: primaryRow.accounts?.name ?? "Unknown account",
        accountClass: primaryRow.accounts?.account_class ?? "asset",
      },
    });
  }

  return items;
}

export type TransactionFilters = {
  page: number;
  pageSize: number;
  search?: string | undefined;
  kind?: ManualTransactionType | undefined;
  accountId?: string | undefined;
  categoryId?: string | undefined;
  status?: TransactionStatus | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  minAmount?: string | undefined;
  maxAmount?: string | undefined;
};

export type TransactionListItem = {
  transaction: LedgerTransaction;
  primaryEntry: TransactionEntryDetail;
  categoryName: string | null;
  payeeName: string | null;
};

export type TransactionListResult = {
  items: TransactionListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

const EMPTY_TRANSACTION_LIST = (
  filters: Pick<TransactionFilters, "page" | "pageSize">,
): TransactionListResult => ({
  items: [],
  totalCount: 0,
  page: filters.page,
  pageSize: filters.pageSize,
});

/**
 * Server-side paginated, filtered, searchable transaction history.
 * Filters that apply directly to ledger_transactions (kind, status, date
 * range, category, free-text search on description/notes/source_reference)
 * are pushed into the main query; account and amount filters — which live
 * on ledger_entries, not the transaction header — resolve to a set of
 * candidate transaction ids first (a second, narrow query), matching this
 * codebase's established "two queries plus an in-memory join, rather than
 * a single complex query" convention (see listAccountsWithBalances).
 */
export async function listTransactionsForUser(
  supabase: SupabaseClient<Database>,
  filters: TransactionFilters,
): Promise<TransactionListResult> {
  let matchingIds: string[] | null = null;

  if (filters.accountId) {
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("transaction_id")
      .eq("account_id", filters.accountId);

    if (error) {
      return EMPTY_TRANSACTION_LIST(filters);
    }
    matchingIds = [...new Set((data ?? []).map((row) => row.transaction_id))];
    if (matchingIds.length === 0) {
      return EMPTY_TRANSACTION_LIST(filters);
    }
  }

  if (filters.minAmount || filters.maxAmount) {
    let amountQuery = supabase
      .from("ledger_entries")
      .select("transaction_id, amount");
    if (filters.minAmount) {
      const min = Number(filters.minAmount);
      amountQuery = amountQuery.or(`amount.gte.${min},amount.lte.${-min}`);
    }
    const { data, error } = await amountQuery;
    if (error) {
      return EMPTY_TRANSACTION_LIST(filters);
    }
    const max = filters.maxAmount ? Number(filters.maxAmount) : null;
    const idsWithinRange = new Set(
      (data ?? [])
        .filter((row) => (max === null ? true : Math.abs(row.amount) <= max))
        .map((row) => row.transaction_id),
    );
    matchingIds =
      matchingIds === null
        ? [...idsWithinRange]
        : matchingIds.filter((id) => idsWithinRange.has(id));
    if (matchingIds.length === 0) {
      return EMPTY_TRANSACTION_LIST(filters);
    }
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim();
    const { data: matchingPayees } = await supabase
      .from("payees")
      .select("id")
      .ilike("name", `%${term}%`);
    const payeeIds = (matchingPayees ?? []).map((row) => row.id);

    const orParts = [
      `description.ilike.%${term}%`,
      `notes.ilike.%${term}%`,
      `source_reference.ilike.%${term}%`,
    ];
    if (payeeIds.length > 0) {
      orParts.push(`payee_id.in.(${payeeIds.join(",")})`);
    }

    const { data: searchMatches, error } = await supabase
      .from("ledger_transactions")
      .select("id")
      .or(orParts.join(","));

    if (error) {
      return EMPTY_TRANSACTION_LIST(filters);
    }
    const searchIds = new Set((searchMatches ?? []).map((row) => row.id));
    matchingIds =
      matchingIds === null
        ? [...searchIds]
        : matchingIds.filter((id) => searchIds.has(id));
    if (matchingIds.length === 0) {
      return EMPTY_TRANSACTION_LIST(filters);
    }
  }

  let query = supabase
    .from("ledger_transactions")
    .select(
      "*, ledger_entries(*, accounts(name, account_class, is_system)), categories(name), payees(name)",
      { count: "exact" },
    )
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });

  if (matchingIds !== null) {
    query = query.in("id", matchingIds);
  }
  if (filters.kind) {
    query = query.eq("transaction_type", filters.kind);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.dateFrom) {
    query = query.gte("occurred_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("occurred_at", `${filters.dateTo}T23:59:59.999Z`);
  }

  const from = filters.page * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error || !data) {
    return EMPTY_TRANSACTION_LIST(filters);
  }

  const items: TransactionListItem[] = [];

  for (const row of data) {
    const {
      ledger_entries: entryRows,
      categories,
      payees,
      ...transactionFields
    } = row;
    const primaryRow =
      entryRows.find((entry) => entry.accounts && !entry.accounts.is_system) ??
      entryRows[0];

    if (!primaryRow) {
      continue;
    }

    items.push({
      transaction: mapLedgerTransactionRow(transactionFields),
      primaryEntry: {
        ...mapLedgerEntryRow(primaryRow),
        accountName: primaryRow.accounts?.name ?? "Unknown account",
        accountClass: primaryRow.accounts?.account_class ?? "asset",
      },
      categoryName: categories?.name ?? null,
      payeeName: payees?.name ?? null,
    });
  }

  return {
    items,
    totalCount: count ?? items.length,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export type DashboardSummary = {
  totalIncome: Money;
  totalExpense: Money;
  netCashFlow: Money;
};

/** Real income/expense/net-cash-flow totals for [start, end] (inclusive), via public.dashboard_summary — see supabase/migrations. */
export async function getDashboardSummary(
  supabase: SupabaseClient<Database>,
  start: string,
  end: string,
): Promise<DashboardSummary> {
  const { data, error } = await supabase
    .rpc("dashboard_summary", { p_start: start, p_end: end })
    .maybeSingle();

  if (error || !data) {
    return {
      totalIncome: new Decimal(0),
      totalExpense: new Decimal(0),
      netCashFlow: new Decimal(0),
    };
  }

  return {
    totalIncome: new Decimal(data.total_income ?? 0),
    totalExpense: new Decimal(data.total_expense ?? 0),
    netCashFlow: new Decimal(data.net_cash_flow ?? 0),
  };
}

export type CategoryExpenseBreakdown = {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  totalAmount: Money;
};

/** Expense total per category for [start, end] (inclusive), via public.dashboard_expense_by_category — see supabase/migrations. */
export async function getExpenseByCategory(
  supabase: SupabaseClient<Database>,
  start: string,
  end: string,
): Promise<CategoryExpenseBreakdown[]> {
  const { data, error } = await supabase.rpc("dashboard_expense_by_category", {
    p_start: start,
    p_end: end,
  });

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name ?? "Uncategorized",
      categoryIcon: row.category_icon,
      categoryColor: row.category_color,
      totalAmount: new Decimal(row.total_amount ?? 0),
    }))
    .filter((row) => !row.totalAmount.isZero());
}
