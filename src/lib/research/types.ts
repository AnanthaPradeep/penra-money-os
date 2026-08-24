import type { Tables } from "@/types/database.types";

export type CompanyProfileRow = Tables<"company_profiles">;
export type CompanyFinancialPeriodRow = Tables<"company_financial_periods">;
export type CompanyFinancialMetricRow = Tables<"company_financial_metrics">;
export type WatchlistRow = Tables<"watchlists">;
export type WatchlistItemRow = Tables<"watchlist_items">;
export type ResearchNoteRow = Tables<"research_notes">;
export type CompanyFilingRow = Tables<"company_filings">;
export type InvestmentThesisRow = Tables<"investment_theses">;
export type InvestmentThesisVersionRow = Tables<"investment_thesis_versions">;
export type InvestmentIdeaRow = Tables<"investment_ideas">;
export type ResearchReviewEventRow = Tables<"research_review_events">;

export const PERIOD_TYPES = ["annual", "quarterly"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

export const STATEMENT_BASES = ["consolidated", "standalone"] as const;
export type StatementBasis = (typeof STATEMENT_BASES)[number];

export const STATEMENT_TYPES = [
  "income_statement",
  "balance_sheet",
  "cash_flow",
  "ratio",
] as const;
export type StatementType = (typeof STATEMENT_TYPES)[number];

export const STATEMENT_TYPE_LABELS: Record<StatementType, string> = {
  income_statement: "Income statement",
  balance_sheet: "Balance sheet",
  cash_flow: "Cash flow",
  ratio: "Ratio",
};

/** Every metric_key company_financial_metrics can hold — mirrors the CHECK constraint in the Phase 9 migration exactly (kept as a single source of truth for the app layer; the DB constraint is the independent defense-in-depth copy). */
export const METRIC_KEYS = [
  // income_statement
  "revenue",
  "cost_of_revenue",
  "gross_profit",
  "operating_expenses",
  "operating_income",
  "ebitda",
  "interest_expense",
  "profit_before_tax",
  "tax_expense",
  "net_income",
  "eps_basic",
  "eps_diluted",
  "shares_outstanding",
  // balance_sheet
  "cash_and_equivalents",
  "current_assets",
  "total_assets",
  "current_liabilities",
  "total_liabilities",
  "short_term_debt",
  "long_term_debt",
  "total_debt",
  "shareholder_equity",
  "retained_earnings",
  // cash_flow
  "operating_cash_flow",
  "capital_expenditure",
  "investing_cash_flow",
  "financing_cash_flow",
  "dividends_paid",
  "debt_issuance",
  "debt_repayment",
  "free_cash_flow",
  // ratio (provider-supplied only)
  "pe_ratio",
  "pb_ratio",
  "ps_ratio",
  "dividend_yield",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: "Revenue",
  cost_of_revenue: "Cost of revenue",
  gross_profit: "Gross profit",
  operating_expenses: "Operating expenses",
  operating_income: "Operating income",
  ebitda: "EBITDA",
  interest_expense: "Interest expense",
  profit_before_tax: "Profit before tax",
  tax_expense: "Tax expense",
  net_income: "Net income",
  eps_basic: "EPS (basic)",
  eps_diluted: "EPS (diluted)",
  shares_outstanding: "Shares outstanding",
  cash_and_equivalents: "Cash & equivalents",
  current_assets: "Current assets",
  total_assets: "Total assets",
  current_liabilities: "Current liabilities",
  total_liabilities: "Total liabilities",
  short_term_debt: "Short-term debt",
  long_term_debt: "Long-term debt",
  total_debt: "Total debt",
  shareholder_equity: "Shareholder equity",
  retained_earnings: "Retained earnings",
  operating_cash_flow: "Operating cash flow",
  capital_expenditure: "Capital expenditure",
  investing_cash_flow: "Investing cash flow",
  financing_cash_flow: "Financing cash flow",
  dividends_paid: "Dividends paid",
  debt_issuance: "Debt issuance",
  debt_repayment: "Debt repayment",
  free_cash_flow: "Free cash flow",
  pe_ratio: "P/E ratio (provider)",
  pb_ratio: "P/B ratio (provider)",
  ps_ratio: "P/S ratio (provider)",
  dividend_yield: "Dividend yield (provider)",
};

export const INCOME_STATEMENT_METRIC_KEYS: readonly MetricKey[] = [
  "revenue",
  "cost_of_revenue",
  "gross_profit",
  "operating_expenses",
  "operating_income",
  "ebitda",
  "interest_expense",
  "profit_before_tax",
  "tax_expense",
  "net_income",
  "eps_basic",
  "eps_diluted",
  "shares_outstanding",
];
export const BALANCE_SHEET_METRIC_KEYS: readonly MetricKey[] = [
  "cash_and_equivalents",
  "current_assets",
  "total_assets",
  "current_liabilities",
  "total_liabilities",
  "short_term_debt",
  "long_term_debt",
  "total_debt",
  "shareholder_equity",
  "retained_earnings",
];
export const CASH_FLOW_METRIC_KEYS: readonly MetricKey[] = [
  "operating_cash_flow",
  "capital_expenditure",
  "investing_cash_flow",
  "financing_cash_flow",
  "dividends_paid",
  "debt_issuance",
  "debt_repayment",
  "free_cash_flow",
];

export const UNIT_SCALES = [
  "unit",
  "thousand",
  "million",
  "crore",
  "lakh",
] as const;
export type UnitScale = (typeof UNIT_SCALES)[number];

export const WATCHLIST_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;
export type WatchlistColor = (typeof WATCHLIST_COLORS)[number];

export const WATCHLIST_ICONS = [
  "star",
  "eye",
  "flag",
  "bookmark",
  "target",
  "trending-up",
  "briefcase",
  "lightbulb",
] as const;
export type WatchlistIcon = (typeof WATCHLIST_ICONS)[number];

export const WATCHLIST_STATUSES = ["active", "archived"] as const;
export type WatchlistStatus = (typeof WATCHLIST_STATUSES)[number];

export const RESEARCH_PRIORITIES = ["low", "medium", "high"] as const;
export type ResearchPriority = (typeof RESEARCH_PRIORITIES)[number];

export const RESEARCH_STATUSES = [
  "unreviewed",
  "researching",
  "watching",
  "thesis_ready",
  "rejected",
  "archived",
] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

export const RESEARCH_STATUS_LABELS: Record<ResearchStatus, string> = {
  unreviewed: "Unreviewed",
  researching: "Researching",
  watching: "Watching",
  thesis_ready: "Thesis ready",
  rejected: "Rejected",
  archived: "Archived",
};

export const NOTE_TYPES = [
  "general",
  "financial_result",
  "filing",
  "management",
  "risk",
  "catalyst",
  "valuation",
  "decision",
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  general: "General",
  financial_result: "Financial result",
  filing: "Filing",
  management: "Management",
  risk: "Risk",
  catalyst: "Catalyst",
  valuation: "Valuation",
  decision: "Decision",
};

export const FILING_CATEGORIES = [
  "annual_report",
  "quarterly_result",
  "announcement",
  "investor_presentation",
  "credit_rating",
  "regulatory_filing",
  "other",
] as const;
export type FilingCategory = (typeof FILING_CATEGORIES)[number];

export const FILING_CATEGORY_LABELS: Record<FilingCategory, string> = {
  annual_report: "Annual report",
  quarterly_result: "Quarterly result",
  announcement: "Announcement",
  investor_presentation: "Investor presentation",
  credit_rating: "Credit rating",
  regulatory_filing: "Regulatory filing",
  other: "Other",
};

export const TIME_HORIZONS = [
  "short_term",
  "medium_term",
  "long_term",
] as const;
export type TimeHorizon = (typeof TIME_HORIZONS)[number];

export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  short_term: "Short-term",
  medium_term: "Medium-term",
  long_term: "Long-term",
};

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const THESIS_STATUSES = [
  "draft",
  "active",
  "needs_review",
  "invalidated",
  "closed",
  "archived",
] as const;
export type ThesisStatus = (typeof THESIS_STATUSES)[number];

export const THESIS_STATUS_LABELS: Record<ThesisStatus, string> = {
  draft: "Draft",
  active: "Active",
  needs_review: "Needs review",
  invalidated: "Invalidated",
  closed: "Closed",
  archived: "Archived",
};

export const IDEA_STATUSES = [
  "captured",
  "researching",
  "watching",
  "rejected",
  "approved_for_manual_action",
  "closed",
  "archived",
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  captured: "Captured",
  researching: "Researching",
  watching: "Watching",
  rejected: "Rejected",
  approved_for_manual_action: "Approved (manual action)",
  closed: "Closed",
  archived: "Archived",
};

export const REVIEW_EVENT_TYPES = [
  "watchlist_item_added",
  "watchlist_item_removed",
  "note_created",
  "note_archived",
  "thesis_created",
  "thesis_version_added",
  "thesis_status_changed",
  "idea_created",
  "idea_status_changed",
  "filing_added",
  "review_completed",
] as const;
export type ReviewEventType = (typeof REVIEW_EVENT_TYPES)[number];

export const REMINDER_TYPES = [
  "thesis_overdue",
  "thesis_due_soon",
  "watchlist_review_due",
] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];
