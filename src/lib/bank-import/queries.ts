import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { Decimal, type Money } from "@/lib/money/decimal";
import { MATCH_DATE_WINDOW_DAYS } from "@/lib/bank-import/limits";
import {
  mapColumnMappingPresetRow,
  mapImportRuleRow,
  mapRowMatchRow,
  mapStatementImportRow,
  mapStatementImportRowRow,
  type ImportRule,
  type RowMatch,
  type StatementColumnMappingPreset,
  type StatementImport,
  type StatementImportRowDomain,
} from "@/lib/bank-import/mapping";
import type {
  ExistingLedgerRowForMatching,
  RowDirection,
} from "@/lib/bank-import/types";
import type { Database } from "@/types/database.types";

/** Ledger-entry sign is universal regardless of account class (see reconciliation.ts's design note): positive (debit) always corresponds to the bank statement's own "credit" direction, negative to "debit". */
function ledgerEntryAmountToDirection(amount: number): RowDirection {
  return amount > 0 ? "credit" : "debit";
}

export async function listStatementImports(
  supabase: SupabaseClient<Database>,
  opts?: { accountId?: string; limit?: number },
): Promise<StatementImport[]> {
  let query = supabase
    .from("statement_imports")
    .select("*")
    .order("created_at", { ascending: false });

  if (opts?.accountId) {
    query = query.eq("account_id", opts.accountId);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map(mapStatementImportRow);
}

export async function getStatementImportById(
  supabase: SupabaseClient<Database>,
  importId: string,
): Promise<StatementImport | null> {
  const { data, error } = await supabase
    .from("statement_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapStatementImportRow(data);
}

export type ListRowsOptions = {
  search?: string;
  decisionFilter?: "pending" | "include" | "exclude";
  page?: number;
  pageSize?: number;
};

export async function listStatementImportRows(
  supabase: SupabaseClient<Database>,
  importId: string,
  opts: ListRowsOptions = {},
): Promise<{ rows: StatementImportRowDomain[]; totalCount: number }> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("statement_import_rows")
    .select("*", { count: "exact" })
    .eq("import_id", importId)
    .order("row_index", { ascending: true });

  if (opts.decisionFilter) {
    query = query.eq("user_decision", opts.decisionFilter);
  }
  if (opts.search && opts.search.trim().length > 0) {
    const escaped = opts.search.trim().replace(/[%,]/g, "");
    if (escaped.length > 0) {
      query = query.or(
        `description.ilike.%${escaped}%,reference.ilike.%${escaped}%`,
      );
    }
  }

  const { data, error, count } = await query.range(from, to);
  if (error || !data) {
    return { rows: [], totalCount: 0 };
  }
  return {
    rows: data.map(mapStatementImportRowRow),
    totalCount: count ?? data.length,
  };
}

export async function getStatementImportRowById(
  supabase: SupabaseClient<Database>,
  rowId: string,
): Promise<StatementImportRowDomain | null> {
  const { data, error } = await supabase
    .from("statement_import_rows")
    .select("*")
    .eq("id", rowId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapStatementImportRowRow(data);
}

export async function listColumnMappingPresets(
  supabase: SupabaseClient<Database>,
): Promise<StatementColumnMappingPreset[]> {
  const { data, error } = await supabase
    .from("statement_column_mappings")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data
    .map(mapColumnMappingPresetRow)
    .filter(
      (preset): preset is StatementColumnMappingPreset => preset !== null,
    );
}

export async function findColumnMappingPresetByFingerprint(
  supabase: SupabaseClient<Database>,
  headerFingerprint: string,
): Promise<StatementColumnMappingPreset | null> {
  const { data, error } = await supabase
    .from("statement_column_mappings")
    .select("*")
    .eq("header_fingerprint", headerFingerprint)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapColumnMappingPresetRow(data);
}

export async function listImportRules(
  supabase: SupabaseClient<Database>,
): Promise<ImportRule[]> {
  const { data, error } = await supabase
    .from("statement_import_rules")
    .select("*")
    .order("priority", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapImportRuleRow);
}

export async function listRowMatches(
  supabase: SupabaseClient<Database>,
  importRowId: string,
): Promise<RowMatch[]> {
  const { data, error } = await supabase
    .from("statement_import_row_matches")
    .select("*")
    .eq("import_row_id", importRowId)
    .order("score", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapRowMatchRow);
}

/** Bulk variant of listRowMatches for a whole page of review rows, keyed by import_row_id — avoids one query per row. */
export async function listRowMatchesByRowIds(
  supabase: SupabaseClient<Database>,
  importRowIds: string[],
): Promise<Map<string, RowMatch[]>> {
  const byRow = new Map<string, RowMatch[]>();
  if (importRowIds.length === 0) {
    return byRow;
  }

  const { data, error } = await supabase
    .from("statement_import_row_matches")
    .select("*")
    .in("import_row_id", importRowIds)
    .order("score", { ascending: false });

  if (error || !data) {
    return byRow;
  }

  for (const row of data) {
    const mapped = mapRowMatchRow(row);
    const existing = byRow.get(mapped.importRowId);
    if (existing) {
      existing.push(mapped);
    } else {
      byRow.set(mapped.importRowId, [mapped]);
    }
  }
  return byRow;
}

function isoDateWindow(
  centerDateIso: string,
  windowDays: number,
): { fromIso: string; toIso: string } {
  const center = new Date(`${centerDateIso}T00:00:00.000Z`);
  const from = new Date(center.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const to = new Date(
    center.getTime() + (windowDays + 1) * 24 * 60 * 60 * 1000,
  );
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

/**
 * Bounded, indexed candidate lookup for one row's existing-transaction
 * matches — restricted to the row's own account and a small date window,
 * never a full-ledger scan. Rows already claimed by another statement row
 * (see statement_import_rows_linked_existing_unique) are excluded so a
 * transaction can never be suggested as a candidate for two rows at once.
 */
export async function findExistingTransactionCandidates(
  supabase: SupabaseClient<Database>,
  params: { accountId: string; transactionDate: string; windowDays?: number },
): Promise<ExistingLedgerRowForMatching[]> {
  const windowDays = params.windowDays ?? MATCH_DATE_WINDOW_DAYS;
  const { fromIso, toIso } = isoDateWindow(params.transactionDate, windowDays);

  // Two bounded, indexed queries joined in memory (this codebase's
  // established pattern — see listAccountsWithBalances) rather than a
  // single embedded-relation query with a filter on the embedded table,
  // which isn't reliably supported through this Supabase client.
  const [entriesResult, transactionsResult, alreadyLinkedResult] =
    await Promise.all([
      supabase
        .from("ledger_entries")
        .select("account_id, amount, currency, transaction_id")
        .eq("account_id", params.accountId)
        .limit(500),
      supabase
        .from("ledger_transactions")
        .select("id, occurred_at, description, source_reference, status")
        .eq("status", "posted")
        .gte("occurred_at", fromIso)
        .lt("occurred_at", toIso)
        .limit(500),
      supabase
        .from("statement_import_rows")
        .select("linked_existing_transaction_id")
        .not("linked_existing_transaction_id", "is", null),
    ]);

  if (
    entriesResult.error ||
    !entriesResult.data ||
    transactionsResult.error ||
    !transactionsResult.data
  ) {
    return [];
  }

  const alreadyLinked = new Set(
    (alreadyLinkedResult.data ?? [])
      .map((row) => row.linked_existing_transaction_id)
      .filter((id): id is string => id !== null),
  );

  const transactionById = new Map(
    transactionsResult.data.map((txn) => [txn.id, txn]),
  );

  const candidates: ExistingLedgerRowForMatching[] = [];
  for (const entry of entriesResult.data) {
    const txn = transactionById.get(entry.transaction_id);
    if (!txn || alreadyLinked.has(txn.id)) {
      continue;
    }
    candidates.push({
      transactionId: txn.id,
      accountId: entry.account_id,
      occurredOn: txn.occurred_at.slice(0, 10),
      amount: new Decimal(entry.amount).abs(),
      direction: ledgerEntryAmountToDirection(entry.amount),
      description: txn.description,
      sourceReference: txn.source_reference,
    });
  }
  return candidates;
}

export type TransferCandidateRow = {
  rowId: string;
  importId: string;
  accountId: string;
  transactionDate: string;
  amount: Money;
  direction: RowDirection;
  currency: string;
  description: string;
  reference: string | null;
};

/**
 * Bounded search for the *other leg* of a possible internal transfer —
 * restricted to the caller's own other unresolved staged rows (any import
 * still in reviewing/ready, excluding the account the row itself belongs
 * to and any row already claimed by a transfer group), never a scan across
 * posted ledger history (an already-posted counterpart is handled instead
 * by findExistingTransactionCandidates + an explicit existing-transaction
 * link).
 */
export async function findTransferCandidateRows(
  supabase: SupabaseClient<Database>,
  params: {
    excludeAccountId: string;
    currency: string;
    transactionDate: string;
    windowDays?: number;
  },
): Promise<TransferCandidateRow[]> {
  const windowDays = params.windowDays ?? MATCH_DATE_WINDOW_DAYS;
  const center = new Date(`${params.transactionDate}T00:00:00.000Z`).getTime();
  const fromDate = new Date(center - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const toDate = new Date(center + windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: openImports, error: importsError } = await supabase
    .from("statement_imports")
    .select("id")
    .in("status", ["reviewing", "ready"])
    .neq("account_id", params.excludeAccountId)
    .eq("currency", params.currency);

  if (importsError || !openImports || openImports.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("statement_import_rows")
    .select(
      "id, import_id, account_id, transaction_date, amount, direction, currency, description, reference",
    )
    .in(
      "import_id",
      openImports.map((row) => row.id),
    )
    .is("transfer_group_id", null)
    .neq("user_decision", "exclude")
    .not("transaction_date", "is", null)
    .not("amount", "is", null)
    .gte("transaction_date", fromDate)
    .lte("transaction_date", toDate)
    .limit(200);

  if (error || !data) {
    return [];
  }

  const candidates: TransferCandidateRow[] = [];
  for (const row of data) {
    if (!row.transaction_date || row.amount === null || !row.direction) {
      continue;
    }
    candidates.push({
      rowId: row.id,
      importId: row.import_id,
      accountId: row.account_id,
      transactionDate: row.transaction_date,
      amount: new Decimal(row.amount),
      direction: row.direction === "debit" ? "debit" : "credit",
      currency: row.currency,
      description: row.description,
      reference: row.reference,
    });
  }
  return candidates;
}

export type BankImportDashboardSummary = {
  awaitingReviewCount: number;
  failedCount: number;
  unreconciledCount: number;
  lastCompletedImport: StatementImport | null;
};

/** Dashboard widget data — isolated counts only, never folded into the existing income/expense/net-worth totals until a row actually posts. */
export async function getBankImportDashboardSummary(
  supabase: SupabaseClient<Database>,
): Promise<BankImportDashboardSummary> {
  const [awaitingReview, failed, unreconciled, lastCompleted] =
    await Promise.all([
      supabase
        .from("statement_imports")
        .select("id", { count: "exact", head: true })
        .in("status", ["parsed", "reviewing", "ready"]),
      supabase
        .from("statement_imports")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from("statement_imports")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .in("reconciliation_status", [
          "difference",
          "incomplete",
          "in_progress",
          "not_started",
        ]),
      supabase
        .from("statement_imports")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    awaitingReviewCount: awaitingReview.count ?? 0,
    failedCount: failed.count ?? 0,
    unreconciledCount: unreconciled.count ?? 0,
    lastCompletedImport: lastCompleted.data
      ? mapStatementImportRow(lastCompleted.data)
      : null,
  };
}

export type AccountImportSummary = {
  lastImport: StatementImport | null;
};

export async function getAccountImportSummary(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<AccountImportSummary> {
  const { data } = await supabase
    .from("statement_imports")
    .select("*")
    .eq("account_id", accountId)
    .neq("status", "discarded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { lastImport: data ? mapStatementImportRow(data) : null };
}
