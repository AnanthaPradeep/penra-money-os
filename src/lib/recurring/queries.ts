import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapRecurringItemRow,
  mapRecurringOccurrenceRow,
  type OccurrenceWithItem,
  type RecurringItem,
  type RecurringOccurrence,
} from "@/lib/recurring/mapping";
import {
  RECURRING_ITEM_KINDS,
  PROCESSING_MODES,
  type RecurringItemKind,
  type RecurringItemStatus,
} from "@/lib/recurring/types";
import { Decimal, type Money } from "@/lib/money/decimal";
import { assertLiteral } from "@/lib/types/literal";
import type { Database } from "@/types/database.types";

/** Lists the caller's own recurring items (all kinds/statuses unless filtered), newest-created last-touched first via name for stable ordering. */
export async function listRecurringItems(
  supabase: SupabaseClient<Database>,
  filters?: { kind?: RecurringItemKind; status?: RecurringItemStatus },
): Promise<RecurringItem[]> {
  let query = supabase.from("recurring_items").select("*");

  if (filters?.kind) {
    query = query.eq("kind", filters.kind);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapRecurringItemRow);
}

export async function getRecurringItemById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<RecurringItem | null> {
  const { data, error } = await supabase
    .from("recurring_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRecurringItemRow(data);
}

type OccurrenceJoinRow = {
  id: string;
  recurring_item_id: string;
  scheduled_date: string;
  amount: number;
  currency: string;
  status: string;
  linked_transaction_id: string | null;
  failure_reason: string | null;
  processed_at: string | null;
  recurring_items: {
    name: string;
    kind: string;
    processing_mode: string;
  } | null;
};

function mapOccurrenceJoinRow(
  row: OccurrenceJoinRow,
): OccurrenceWithItem | null {
  if (!row.recurring_items) {
    return null;
  }
  return {
    id: row.id,
    recurringItemId: row.recurring_item_id,
    scheduledDate: row.scheduled_date,
    amount: new Decimal(row.amount),
    currency: row.currency,
    status: assertLiteral(
      row.status,
      [
        "upcoming",
        "due",
        "overdue",
        "posted",
        "skipped",
        "failed",
        "cancelled",
      ] as const,
      "recurring_occurrences.status",
    ),
    linkedTransactionId: row.linked_transaction_id,
    failureReason: row.failure_reason,
    processedAt: row.processed_at,
    itemName: row.recurring_items.name,
    itemKind: assertLiteral(
      row.recurring_items.kind,
      RECURRING_ITEM_KINDS,
      "recurring_items.kind",
    ),
    processingMode: assertLiteral(
      row.recurring_items.processing_mode,
      PROCESSING_MODES,
      "recurring_items.processing_mode",
    ),
  };
}

/** Every occurrence for one recurring item, newest-scheduled first — the item detail page's history list. */
export async function listOccurrencesForItem(
  supabase: SupabaseClient<Database>,
  recurringItemId: string,
): Promise<RecurringOccurrence[]> {
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select("*")
    .eq("recurring_item_id", recurringItemId)
    .order("scheduled_date", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapRecurringOccurrenceRow);
}

export type OccurrenceStatusFilter =
  "upcoming" | "due" | "overdue" | "failed" | "all";

/** Occurrences joined with their parent item's name/kind/processing mode, for the recurring items overview's upcoming/due/overdue/failed tabs. */
export async function listOccurrencesWithItems(
  supabase: SupabaseClient<Database>,
  filter: OccurrenceStatusFilter,
): Promise<OccurrenceWithItem[]> {
  let query = supabase
    .from("recurring_occurrences")
    .select(
      "id, recurring_item_id, scheduled_date, amount, currency, status, linked_transaction_id, failure_reason, processed_at, recurring_items(name, kind, processing_mode)",
    );

  if (filter !== "all") {
    query = query.eq("status", filter);
  } else {
    query = query.in("status", ["upcoming", "due", "overdue", "failed"]);
  }

  const { data, error } = await query.order("scheduled_date", {
    ascending: true,
  });

  if (error || !data) {
    return [];
  }

  const rows: OccurrenceWithItem[] = [];
  for (const row of data) {
    const mapped = mapOccurrenceJoinRow(row);
    if (mapped) {
      rows.push(mapped);
    }
  }
  return rows;
}

/** Occurrences due within the next `withinDays` days (or already overdue), for dashboard reminder surfaces. Excludes cancelled/skipped/posted — those are resolved, not upcoming commitments. */
export async function listUpcomingCommitments(
  supabase: SupabaseClient<Database>,
  withinIsoDate: string,
): Promise<OccurrenceWithItem[]> {
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(
      "id, recurring_item_id, scheduled_date, amount, currency, status, linked_transaction_id, failure_reason, processed_at, recurring_items(name, kind, processing_mode)",
    )
    .in("status", ["upcoming", "due", "overdue", "failed"])
    .lte("scheduled_date", withinIsoDate)
    .order("scheduled_date", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rows: OccurrenceWithItem[] = [];
  for (const row of data) {
    const mapped = mapOccurrenceJoinRow(row);
    if (mapped) {
      rows.push(mapped);
    }
  }
  return rows;
}

export type SubscriptionCostSummary = {
  monthlyEstimate: Money;
  annualEstimate: Money;
  activeSubscriptionCount: number;
};

/** Normalized monthly/annual subscription cost estimate — see public.subscription_cost_summary. */
export async function getSubscriptionCostSummary(
  supabase: SupabaseClient<Database>,
): Promise<SubscriptionCostSummary> {
  const { data, error } = await supabase
    .rpc("subscription_cost_summary")
    .maybeSingle();

  if (error || !data) {
    return {
      monthlyEstimate: new Decimal(0),
      annualEstimate: new Decimal(0),
      activeSubscriptionCount: 0,
    };
  }

  return {
    monthlyEstimate: new Decimal(data.monthly_estimate),
    annualEstimate: new Decimal(data.annual_estimate),
    activeSubscriptionCount: data.active_subscription_count,
  };
}

export type LinkableTransaction = {
  id: string;
  description: string;
  occurredAt: string;
  amount: Money;
  currency: string;
  accountName: string;
};

const KIND_TO_TRANSACTION_TYPES: Record<RecurringItemKind, string[]> = {
  bill: ["expense", "credit_card_purchase"],
  subscription: ["expense", "credit_card_purchase"],
  income: ["income"],
  transfer: ["transfer"],
};

/**
 * Recent posted, non-reversed transactions of a compatible type that
 * aren't already linked to another occurrence — the candidate list for
 * "link an existing transaction" (see link_existing_transaction_to_
 * occurrence, supabase/migrations, which re-validates all of this
 * server-side regardless of what this list shows).
 */
export async function listLinkableTransactions(
  supabase: SupabaseClient<Database>,
  kind: RecurringItemKind,
  limit = 20,
): Promise<LinkableTransaction[]> {
  const { data: linkedRows } = await supabase
    .from("recurring_occurrences")
    .select("linked_transaction_id")
    .not("linked_transaction_id", "is", null);
  const linkedIds = new Set(
    (linkedRows ?? [])
      .map((row) => row.linked_transaction_id)
      .filter((id): id is string => id !== null),
  );

  const { data, error } = await supabase
    .from("ledger_transactions")
    .select("*, ledger_entries(*, accounts(name, is_system))")
    .eq("status", "posted")
    .in("transaction_type", KIND_TO_TRANSACTION_TYPES[kind])
    .order("occurred_at", { ascending: false })
    .limit(limit * 2);

  if (error || !data) {
    return [];
  }

  const items: LinkableTransaction[] = [];
  for (const row of data) {
    if (linkedIds.has(row.id) || items.length >= limit) {
      continue;
    }
    const entryRows = row.ledger_entries;
    const primaryRow =
      entryRows.find((entry) => entry.accounts && !entry.accounts.is_system) ??
      entryRows[0];
    if (!primaryRow) {
      continue;
    }
    items.push({
      id: row.id,
      description: row.description,
      occurredAt: row.occurred_at,
      amount: new Decimal(primaryRow.amount).abs(),
      currency: primaryRow.currency,
      accountName: primaryRow.accounts?.name ?? "Unknown account",
    });
  }

  return items;
}
