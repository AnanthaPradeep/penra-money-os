import type { Tables } from "@/types/database.types";

export type RecurringItemRow = Tables<"recurring_items">;
export type RecurringOccurrenceRow = Tables<"recurring_occurrences">;

export const RECURRING_ITEM_KINDS = [
  "subscription",
  "bill",
  "income",
  "transfer",
] as const;
export type RecurringItemKind = (typeof RECURRING_ITEM_KINDS)[number];

export const RECURRING_ITEM_KIND_LABELS: Record<RecurringItemKind, string> = {
  subscription: "Subscription",
  bill: "Bill",
  income: "Recurring income",
  transfer: "Recurring transfer",
};

export const PROCESSING_MODES = ["reminder_only", "auto_post"] as const;
export type ProcessingMode = (typeof PROCESSING_MODES)[number];

export const PROCESSING_MODE_LABELS: Record<ProcessingMode, string> = {
  reminder_only: "Remind me — I'll record it myself",
  auto_post: "Post automatically",
};

export const RECURRING_ITEM_STATUSES = [
  "active",
  "paused",
  "cancelled",
  "archived",
] as const;
export type RecurringItemStatus = (typeof RECURRING_ITEM_STATUSES)[number];

export const OCCURRENCE_STATUSES = [
  "upcoming",
  "due",
  "overdue",
  "posted",
  "skipped",
  "failed",
  "cancelled",
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];
