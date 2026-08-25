import type { Tables } from "@/types/database.types";

export type IpoIssueRow = Tables<"ipo_issues">;
export type IpoStatusHistoryRow = Tables<"ipo_status_history">;
export type IpoDocumentRow = Tables<"ipo_documents">;
export type IpoFinancialMetricRow = Tables<"ipo_financial_metrics">;
export type IpoWatchlistItemRow = Tables<"ipo_watchlist_items">;
export type IpoResearchNoteRow = Tables<"ipo_research_notes">;

export const IPO_BOARDS = ["mainboard", "sme"] as const;
export type IpoBoard = (typeof IPO_BOARDS)[number];
export const IPO_BOARD_LABELS: Record<IpoBoard, string> = {
  mainboard: "Mainboard",
  sme: "SME",
};

export const IPO_ISSUE_TYPES = [
  "fresh_issue",
  "offer_for_sale",
  "fresh_and_ofs",
] as const;
export type IpoIssueType = (typeof IPO_ISSUE_TYPES)[number];
export const IPO_ISSUE_TYPE_LABELS: Record<IpoIssueType, string> = {
  fresh_issue: "Fresh issue",
  offer_for_sale: "Offer for sale",
  fresh_and_ofs: "Fresh issue + offer for sale",
};

/** Never inferred from today's date when official data is missing — always the last explicitly-recorded/verified status. */
export const IPO_STATUSES = [
  "draft_filed",
  "sebi_observation",
  "rhp_filed",
  "open",
  "closed",
  "allotment_pending",
  "allotted",
  "listed",
  "withdrawn",
  "cancelled",
  "unknown",
] as const;
export type IpoStatus = (typeof IPO_STATUSES)[number];
export const IPO_STATUS_LABELS: Record<IpoStatus, string> = {
  draft_filed: "Draft filed",
  sebi_observation: "SEBI observation",
  rhp_filed: "RHP filed",
  open: "Open",
  closed: "Closed",
  allotment_pending: "Allotment pending",
  allotted: "Allotted",
  listed: "Listed",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  unknown: "Unknown",
};

export const IPO_SOURCE_ORGANIZATIONS = [
  "sebi",
  "nse",
  "bse",
  "issuer_ir",
  "other_official",
] as const;
export type IpoSourceOrganization = (typeof IPO_SOURCE_ORGANIZATIONS)[number];
export const IPO_SOURCE_ORGANIZATION_LABELS: Record<
  IpoSourceOrganization,
  string
> = {
  sebi: "SEBI",
  nse: "NSE",
  bse: "BSE",
  issuer_ir: "Issuer investor relations",
  other_official: "Other official source",
};

export const IPO_DOCUMENT_TYPES = [
  "drhp",
  "updated_drhp",
  "rhp",
  "abridged_prospectus",
  "final_prospectus",
  "corrigendum",
  "sebi_observation",
  "issue_summary",
  "other_official",
] as const;
export type IpoDocumentType = (typeof IPO_DOCUMENT_TYPES)[number];
export const IPO_DOCUMENT_TYPE_LABELS: Record<IpoDocumentType, string> = {
  drhp: "DRHP",
  updated_drhp: "Updated DRHP",
  rhp: "RHP",
  abridged_prospectus: "Abridged prospectus",
  final_prospectus: "Final prospectus",
  corrigendum: "Corrigendum",
  sebi_observation: "SEBI observation letter",
  issue_summary: "Issue summary",
  other_official: "Other official document",
};

/** Mirrors the ipo_financial_metrics_key_valid CHECK constraint exactly. */
export const IPO_METRIC_KEYS = [
  "revenue",
  "profit_after_tax",
  "total_assets",
  "total_liabilities",
  "shareholder_equity",
  "borrowings",
  "operating_cash_flow",
  "eps",
  "nav_per_share",
  "pre_issue_shares",
  "post_issue_shares",
  "promoter_holding_pre_issue_percent",
  "promoter_holding_post_issue_percent",
] as const;
export type IpoMetricKey = (typeof IPO_METRIC_KEYS)[number];
export const IPO_METRIC_LABELS: Record<IpoMetricKey, string> = {
  revenue: "Revenue",
  profit_after_tax: "Profit after tax",
  total_assets: "Total assets",
  total_liabilities: "Total liabilities",
  shareholder_equity: "Shareholder equity / net worth",
  borrowings: "Borrowings",
  operating_cash_flow: "Operating cash flow",
  eps: "EPS",
  nav_per_share: "NAV per share",
  pre_issue_shares: "Pre-issue shares",
  post_issue_shares: "Post-issue shares",
  promoter_holding_pre_issue_percent: "Promoter holding — pre-issue (%)",
  promoter_holding_post_issue_percent: "Promoter holding — post-issue (%)",
};

export const IPO_STATEMENT_BASES = ["consolidated", "standalone"] as const;
export type IpoStatementBasis = (typeof IPO_STATEMENT_BASES)[number];

export const IPO_UNIT_SCALES = [
  "unit",
  "thousand",
  "million",
  "crore",
  "lakh",
] as const;
export type IpoUnitScale = (typeof IPO_UNIT_SCALES)[number];

export const IPO_EXTRACTION_METHODS = [
  "manual_entry",
  "ocr",
  "provider_api",
] as const;
export type IpoExtractionMethod = (typeof IPO_EXTRACTION_METHODS)[number];

export const IPO_RESEARCH_PRIORITIES = ["low", "medium", "high"] as const;
export type IpoResearchPriority = (typeof IPO_RESEARCH_PRIORITIES)[number];
export const IPO_RESEARCH_PRIORITY_LABELS: Record<IpoResearchPriority, string> =
  {
    low: "Low priority",
    medium: "Medium priority",
    high: "High priority",
  };

/** Deliberately has no "apply"/"buy" value anywhere in this union — see spec section 5. */
export const IPO_RESEARCH_STATUSES = [
  "unreviewed",
  "researching",
  "watching",
  "not_interested",
  "review_complete",
  "archived",
] as const;
export type IpoResearchStatus = (typeof IPO_RESEARCH_STATUSES)[number];
export const IPO_RESEARCH_STATUS_LABELS: Record<IpoResearchStatus, string> = {
  unreviewed: "Unreviewed",
  researching: "Researching",
  watching: "Watching",
  not_interested: "Not interested",
  review_complete: "Review complete",
  archived: "Archived",
};

export type IpoChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};
