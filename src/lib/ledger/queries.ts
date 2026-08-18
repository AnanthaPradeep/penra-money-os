import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapLedgerEntryRow,
  mapLedgerTransactionRow,
  type LedgerEntry,
  type LedgerTransaction,
} from "@/lib/ledger/mapping";
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
};

/** Reads one of the caller's own transactions together with its entries and each entry's account name. */
export async function getTransactionWithEntries(
  supabase: SupabaseClient<Database>,
  transactionId: string,
): Promise<TransactionDetail | null> {
  const { data: transactionRow, error: transactionError } = await supabase
    .from("ledger_transactions")
    .select("*")
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

  return {
    transaction: mapLedgerTransactionRow(transactionRow),
    entries: entryRows.map((row) => ({
      ...mapLedgerEntryRow(row),
      accountName: row.accounts?.name ?? "Unknown account",
      accountClass: row.accounts?.account_class ?? "asset",
    })),
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
