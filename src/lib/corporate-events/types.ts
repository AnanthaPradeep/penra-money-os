import type { Tables } from "@/types/database.types";

export type CorporateEventRow = Tables<"corporate_events">;

/**
 * Mirrors the corporate_events_type_valid CHECK constraint in the Phase 10
 * migration exactly (kept as a single source of truth for the app layer;
 * the DB constraint is the independent defense-in-depth copy).
 */
export const CORPORATE_EVENT_TYPES = [
  "announcement",
  "financial_results",
  "board_meeting",
  "dividend",
  "stock_split",
  "bonus_issue",
  "rights_issue",
  "buyback",
  "merger_or_demerger",
  "fund_raising",
  "shareholding_update",
  "management_change",
  "credit_rating",
  "insider_trading_disclosure",
  "regulatory_action",
  "other",
] as const;
export type CorporateEventType = (typeof CORPORATE_EVENT_TYPES)[number];

export const CORPORATE_EVENT_TYPE_LABELS: Record<CorporateEventType, string> = {
  announcement: "Announcement",
  financial_results: "Financial results",
  board_meeting: "Board meeting",
  dividend: "Dividend",
  stock_split: "Stock split",
  bonus_issue: "Bonus issue",
  rights_issue: "Rights issue",
  buyback: "Buyback",
  merger_or_demerger: "Merger / demerger",
  fund_raising: "Fund raising",
  shareholding_update: "Shareholding update",
  management_change: "Management change",
  credit_rating: "Credit rating",
  insider_trading_disclosure: "Insider trading disclosure",
  regulatory_action: "Regulatory action",
  other: "Other",
};

export const CORPORATE_EVENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "postponed",
  "cancelled",
] as const;
export type CorporateEventStatus = (typeof CORPORATE_EVENT_STATUSES)[number];

export const CORPORATE_EVENT_STATUS_LABELS: Record<
  CorporateEventStatus,
  string
> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  postponed: "Postponed",
  cancelled: "Cancelled",
};
