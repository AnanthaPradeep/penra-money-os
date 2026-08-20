import { Decimal, type Money } from "@/lib/money/decimal";
import {
  RECURRENCE_FREQUENCIES,
  type RecurrenceFrequency,
} from "@/lib/recurring/schedule";
import {
  OCCURRENCE_STATUSES,
  PROCESSING_MODES,
  RECURRING_ITEM_KINDS,
  RECURRING_ITEM_STATUSES,
  type OccurrenceStatus,
  type ProcessingMode,
  type RecurringItemKind,
  type RecurringItemRow,
  type RecurringItemStatus,
  type RecurringOccurrenceRow,
} from "@/lib/recurring/types";
import { assertLiteral } from "@/lib/types/literal";

export type RecurringItem = {
  id: string;
  name: string;
  kind: RecurringItemKind;
  amount: Money;
  currency: string;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  payeeId: string | null;
  notes: string | null;
  startDate: string;
  endDate: string | null;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  nextDueDate: string | null;
  processingMode: ProcessingMode;
  status: RecurringItemStatus;
  trialEndDate: string | null;
  cancellationDate: string | null;
};

export function mapRecurringItemRow(row: RecurringItemRow): RecurringItem {
  return {
    id: row.id,
    name: row.name,
    kind: assertLiteral(row.kind, RECURRING_ITEM_KINDS, "recurring_items.kind"),
    amount: new Decimal(row.amount),
    currency: row.currency,
    sourceAccountId: row.source_account_id,
    destinationAccountId: row.destination_account_id,
    categoryId: row.category_id,
    payeeId: row.payee_id,
    notes: row.notes,
    startDate: row.start_date,
    endDate: row.end_date,
    frequency: assertLiteral(
      row.frequency,
      RECURRENCE_FREQUENCIES,
      "recurring_items.frequency",
    ),
    intervalCount: row.interval_count,
    nextDueDate: row.next_due_date,
    processingMode: assertLiteral(
      row.processing_mode,
      PROCESSING_MODES,
      "recurring_items.processing_mode",
    ),
    status: assertLiteral(
      row.status,
      RECURRING_ITEM_STATUSES,
      "recurring_items.status",
    ),
    trialEndDate: row.trial_end_date,
    cancellationDate: row.cancellation_date,
  };
}

export type RecurringOccurrence = {
  id: string;
  recurringItemId: string;
  scheduledDate: string;
  amount: Money;
  currency: string;
  status: OccurrenceStatus;
  linkedTransactionId: string | null;
  failureReason: string | null;
  processedAt: string | null;
};

export function mapRecurringOccurrenceRow(
  row: RecurringOccurrenceRow,
): RecurringOccurrence {
  return {
    id: row.id,
    recurringItemId: row.recurring_item_id,
    scheduledDate: row.scheduled_date,
    amount: new Decimal(row.amount),
    currency: row.currency,
    status: assertLiteral(
      row.status,
      OCCURRENCE_STATUSES,
      "recurring_occurrences.status",
    ),
    linkedTransactionId: row.linked_transaction_id,
    failureReason: row.failure_reason,
    processedAt: row.processed_at,
  };
}

/** An occurrence together with its parent item's identifying fields — the shape every occurrence list view (upcoming/due/overdue, dashboard reminders) actually needs. */
export type OccurrenceWithItem = RecurringOccurrence & {
  itemName: string;
  itemKind: RecurringItemKind;
  processingMode: ProcessingMode;
};
