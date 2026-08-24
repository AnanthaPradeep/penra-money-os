import { Decimal, type Money } from "@/lib/money/decimal";
import {
  FILING_CATEGORIES,
  IDEA_STATUSES,
  METRIC_KEYS,
  NOTE_TYPES,
  PERIOD_TYPES,
  RESEARCH_PRIORITIES,
  RESEARCH_STATUSES,
  STATEMENT_BASES,
  STATEMENT_TYPES,
  THESIS_STATUSES,
  TIME_HORIZONS,
  CONFIDENCE_LEVELS,
  UNIT_SCALES,
  WATCHLIST_COLORS,
  WATCHLIST_ICONS,
  WATCHLIST_STATUSES,
  type CompanyFilingRow,
  type CompanyFinancialMetricRow,
  type CompanyFinancialPeriodRow,
  type CompanyProfileRow,
  type FilingCategory,
  type IdeaStatus,
  type InvestmentIdeaRow,
  type InvestmentThesisRow,
  type InvestmentThesisVersionRow,
  type MetricKey,
  type NoteType,
  type PeriodType,
  type ResearchNoteRow,
  type ResearchPriority,
  type ResearchReviewEventRow,
  type ResearchStatus,
  type StatementBasis,
  type StatementType,
  type ThesisStatus,
  type TimeHorizon,
  type ConfidenceLevel,
  type UnitScale,
  type WatchlistColor,
  type WatchlistIcon,
  type WatchlistItemRow,
  type WatchlistRow,
  type WatchlistStatus,
} from "@/lib/research/types";
import { assertLiteral } from "@/lib/types/literal";

export type CompanyProfile = {
  instrumentId: string;
  legalName: string | null;
  country: string | null;
  sector: string | null;
  industry: string | null;
  fiscalYearEnd: string | null;
  website: string | null;
  description: string | null;
  provider: string;
  receivedAt: string;
};

export function mapCompanyProfileRow(row: CompanyProfileRow): CompanyProfile {
  return {
    instrumentId: row.instrument_id,
    legalName: row.legal_name,
    country: row.country,
    sector: row.sector,
    industry: row.industry,
    fiscalYearEnd: row.fiscal_year_end,
    website: row.website,
    description: row.description,
    provider: row.provider,
    receivedAt: row.received_at,
  };
}

export type CompanyFinancialPeriod = {
  id: string;
  instrumentId: string;
  periodType: PeriodType;
  fiscalPeriodEnd: string;
  fiscalYear: number;
  fiscalQuarter: number | null;
  reportDate: string | null;
  currency: string;
  statementBasis: StatementBasis;
  provider: string;
};

export function mapCompanyFinancialPeriodRow(
  row: CompanyFinancialPeriodRow,
): CompanyFinancialPeriod {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    periodType: assertLiteral(
      row.period_type,
      PERIOD_TYPES,
      "company_financial_periods.period_type",
    ),
    fiscalPeriodEnd: row.fiscal_period_end,
    fiscalYear: row.fiscal_year,
    fiscalQuarter: row.fiscal_quarter,
    reportDate: row.report_date,
    currency: row.currency,
    statementBasis: assertLiteral(
      row.statement_basis,
      STATEMENT_BASES,
      "company_financial_periods.statement_basis",
    ),
    provider: row.provider,
  };
}

export type CompanyFinancialMetric = {
  id: string;
  periodId: string;
  statementType: StatementType;
  metricKey: MetricKey;
  value: Money;
  unitScale: UnitScale;
  provider: string;
};

export function mapCompanyFinancialMetricRow(
  row: CompanyFinancialMetricRow,
): CompanyFinancialMetric {
  return {
    id: row.id,
    periodId: row.period_id,
    statementType: assertLiteral(
      row.statement_type,
      STATEMENT_TYPES,
      "company_financial_metrics.statement_type",
    ),
    metricKey: assertLiteral(
      row.metric_key,
      METRIC_KEYS,
      "company_financial_metrics.metric_key",
    ),
    value: new Decimal(row.value),
    unitScale: assertLiteral(
      row.unit_scale,
      UNIT_SCALES,
      "company_financial_metrics.unit_scale",
    ),
    provider: row.provider,
  };
}

export type Watchlist = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: WatchlistColor;
  icon: WatchlistIcon;
  sortOrder: number;
  status: WatchlistStatus;
  createdAt: string;
  updatedAt: string;
};

export function mapWatchlistRow(row: WatchlistRow): Watchlist {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    color: assertLiteral(row.color, WATCHLIST_COLORS, "watchlists.color"),
    icon: assertLiteral(row.icon, WATCHLIST_ICONS, "watchlists.icon"),
    sortOrder: row.sort_order,
    status: assertLiteral(row.status, WATCHLIST_STATUSES, "watchlists.status"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type WatchlistItem = {
  id: string;
  watchlistId: string;
  userId: string;
  instrumentId: string;
  addedAt: string;
  priority: ResearchPriority;
  targetReviewDate: string | null;
  researchStatus: ResearchStatus;
  sortOrder: number;
};

export function mapWatchlistItemRow(row: WatchlistItemRow): WatchlistItem {
  return {
    id: row.id,
    watchlistId: row.watchlist_id,
    userId: row.user_id,
    instrumentId: row.instrument_id,
    addedAt: row.added_at,
    priority: assertLiteral(
      row.priority,
      RESEARCH_PRIORITIES,
      "watchlist_items.priority",
    ),
    targetReviewDate: row.target_review_date,
    researchStatus: assertLiteral(
      row.research_status,
      RESEARCH_STATUSES,
      "watchlist_items.research_status",
    ),
    sortOrder: row.sort_order,
  };
}

export type ResearchNote = {
  id: string;
  userId: string;
  instrumentId: string;
  title: string;
  body: string;
  noteType: NoteType;
  sourceUrl: string | null;
  filingId: string | null;
  observedDate: string | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export function mapResearchNoteRow(row: ResearchNoteRow): ResearchNote {
  return {
    id: row.id,
    userId: row.user_id,
    instrumentId: row.instrument_id,
    title: row.title,
    body: row.body,
    noteType: assertLiteral(
      row.note_type,
      NOTE_TYPES,
      "research_notes.note_type",
    ),
    sourceUrl: row.source_url,
    filingId: row.filing_id,
    observedDate: row.observed_date,
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CompanyFiling = {
  id: string;
  userId: string;
  instrumentId: string;
  category: FilingCategory;
  title: string;
  filingDate: string | null;
  sourceDomain: string;
  sourceUrl: string;
  providerDocumentId: string | null;
  isVerified: boolean;
  notes: string | null;
  createdAt: string;
};

export function mapCompanyFilingRow(row: CompanyFilingRow): CompanyFiling {
  return {
    id: row.id,
    userId: row.user_id,
    instrumentId: row.instrument_id,
    category: assertLiteral(
      row.category,
      FILING_CATEGORIES,
      "company_filings.category",
    ),
    title: row.title,
    filingDate: row.filing_date,
    sourceDomain: row.source_domain,
    sourceUrl: row.source_url,
    providerDocumentId: row.provider_document_id,
    isVerified: row.is_verified,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export type InvestmentThesis = {
  id: string;
  userId: string;
  instrumentId: string;
  title: string;
  summary: string | null;
  investmentCase: string | null;
  opportunities: string | null;
  risks: string | null;
  catalysts: string | null;
  invalidationConditions: string | null;
  expectedReviewDate: string | null;
  timeHorizon: TimeHorizon;
  confidence: ConfidenceLevel;
  status: ThesisStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
};

export function mapInvestmentThesisRow(
  row: InvestmentThesisRow,
): InvestmentThesis {
  return {
    id: row.id,
    userId: row.user_id,
    instrumentId: row.instrument_id,
    title: row.title,
    summary: row.summary,
    investmentCase: row.investment_case,
    opportunities: row.opportunities,
    risks: row.risks,
    catalysts: row.catalysts,
    invalidationConditions: row.invalidation_conditions,
    expectedReviewDate: row.expected_review_date,
    timeHorizon: assertLiteral(
      row.time_horizon,
      TIME_HORIZONS,
      "investment_theses.time_horizon",
    ),
    confidence: assertLiteral(
      row.confidence,
      CONFIDENCE_LEVELS,
      "investment_theses.confidence",
    ),
    status: assertLiteral(
      row.status,
      THESIS_STATUSES,
      "investment_theses.status",
    ),
    currentVersion: row.current_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type InvestmentThesisVersion = {
  id: string;
  thesisId: string;
  version: number;
  title: string;
  summary: string | null;
  investmentCase: string | null;
  opportunities: string | null;
  risks: string | null;
  catalysts: string | null;
  invalidationConditions: string | null;
  timeHorizon: TimeHorizon;
  confidence: ConfidenceLevel;
  status: ThesisStatus;
  createdAt: string;
};

export function mapInvestmentThesisVersionRow(
  row: InvestmentThesisVersionRow,
): InvestmentThesisVersion {
  return {
    id: row.id,
    thesisId: row.thesis_id,
    version: row.version,
    title: row.title,
    summary: row.summary,
    investmentCase: row.investment_case,
    opportunities: row.opportunities,
    risks: row.risks,
    catalysts: row.catalysts,
    invalidationConditions: row.invalidation_conditions,
    timeHorizon: assertLiteral(
      row.time_horizon,
      TIME_HORIZONS,
      "investment_thesis_versions.time_horizon",
    ),
    confidence: assertLiteral(
      row.confidence,
      CONFIDENCE_LEVELS,
      "investment_thesis_versions.confidence",
    ),
    status: assertLiteral(
      row.status,
      THESIS_STATUSES,
      "investment_thesis_versions.status",
    ),
    createdAt: row.created_at,
  };
}

export type InvestmentIdea = {
  id: string;
  userId: string;
  instrumentId: string;
  thesisId: string | null;
  title: string;
  status: IdeaStatus;
  priority: ResearchPriority;
  origin: string | null;
  rationale: string | null;
  riskNotes: string | null;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapInvestmentIdeaRow(row: InvestmentIdeaRow): InvestmentIdea {
  return {
    id: row.id,
    userId: row.user_id,
    instrumentId: row.instrument_id,
    thesisId: row.thesis_id,
    title: row.title,
    status: assertLiteral(row.status, IDEA_STATUSES, "investment_ideas.status"),
    priority: assertLiteral(
      row.priority,
      RESEARCH_PRIORITIES,
      "investment_ideas.priority",
    ),
    origin: row.origin,
    rationale: row.rationale,
    riskNotes: row.risk_notes,
    nextReviewDate: row.next_review_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ResearchReviewEvent = {
  id: string;
  userId: string;
  instrumentId: string | null;
  eventType: string;
  relatedTable: string | null;
  relatedId: string | null;
  summary: string | null;
  occurredAt: string;
};

export function mapResearchReviewEventRow(
  row: ResearchReviewEventRow,
): ResearchReviewEvent {
  return {
    id: row.id,
    userId: row.user_id,
    instrumentId: row.instrument_id,
    eventType: row.event_type,
    relatedTable: row.related_table,
    relatedId: row.related_id,
    summary: row.summary,
    occurredAt: row.occurred_at,
  };
}

type ReminderRow = {
  reminder_type: string;
  instrument_id: string | null;
  related_id: string | null;
  title: string | null;
  due_date: string | null;
};

export type ResearchReminder = {
  reminderType: string;
  instrumentId: string | null;
  relatedId: string | null;
  title: string | null;
  dueDate: string | null;
};

export function mapResearchReminderRow(row: ReminderRow): ResearchReminder {
  return {
    reminderType: row.reminder_type,
    instrumentId: row.instrument_id,
    relatedId: row.related_id,
    title: row.title,
    dueDate: row.due_date,
  };
}
