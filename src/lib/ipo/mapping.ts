import { Decimal, type Money } from "@/lib/money/decimal";
import {
  IPO_BOARDS,
  IPO_DOCUMENT_TYPES,
  IPO_EXTRACTION_METHODS,
  IPO_ISSUE_TYPES,
  IPO_METRIC_KEYS,
  IPO_RESEARCH_PRIORITIES,
  IPO_RESEARCH_STATUSES,
  IPO_SOURCE_ORGANIZATIONS,
  IPO_STATEMENT_BASES,
  IPO_STATUSES,
  IPO_UNIT_SCALES,
  type IpoBoard,
  type IpoChecklistItem,
  type IpoDocumentRow,
  type IpoDocumentType,
  type IpoExtractionMethod,
  type IpoFinancialMetricRow,
  type IpoIssueRow,
  type IpoIssueType,
  type IpoMetricKey,
  type IpoResearchNoteRow,
  type IpoResearchPriority,
  type IpoResearchStatus,
  type IpoSourceOrganization,
  type IpoStatementBasis,
  type IpoStatus,
  type IpoStatusHistoryRow,
  type IpoUnitScale,
  type IpoWatchlistItemRow,
} from "@/lib/ipo/types";
import { assertLiteral } from "@/lib/types/literal";

export type IpoIssue = {
  id: string;
  issuerName: string;
  cin: string | null;
  isin: string | null;
  board: IpoBoard;
  exchange: string | null;
  industry: string | null;
  issueType: IpoIssueType;
  freshIssueAmount: Money | null;
  offerForSaleAmount: Money | null;
  totalIssueSize: Money | null;
  faceValue: Money | null;
  priceBandMin: Money | null;
  priceBandMax: Money | null;
  lotSize: number | null;
  minApplicationQuantity: number | null;
  issueOpenDate: string | null;
  issueCloseDate: string | null;
  anchorDate: string | null;
  basisOfAllotmentDate: string | null;
  refundDate: string | null;
  dematCreditDate: string | null;
  listingDate: string | null;
  finalIssuePrice: Money | null;
  status: IpoStatus;
  linkedInstrumentId: string | null;
  linkedConfirmedAt: string | null;
  sourceOrganization: IpoSourceOrganization;
  sourceUrl: string;
  addedByUserId: string;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
};

function toMoney(value: number | null): Money | null {
  return value === null ? null : new Decimal(value);
}

export function mapIpoIssueRow(row: IpoIssueRow): IpoIssue {
  return {
    id: row.id,
    issuerName: row.issuer_name,
    cin: row.cin,
    isin: row.isin,
    board: assertLiteral(row.board, IPO_BOARDS, "ipo_issues.board"),
    exchange: row.exchange,
    industry: row.industry,
    issueType: assertLiteral(
      row.issue_type,
      IPO_ISSUE_TYPES,
      "ipo_issues.issue_type",
    ),
    freshIssueAmount: toMoney(row.fresh_issue_amount),
    offerForSaleAmount: toMoney(row.offer_for_sale_amount),
    totalIssueSize: toMoney(row.total_issue_size),
    faceValue: toMoney(row.face_value),
    priceBandMin: toMoney(row.price_band_min),
    priceBandMax: toMoney(row.price_band_max),
    lotSize: row.lot_size,
    minApplicationQuantity: row.min_application_quantity,
    issueOpenDate: row.issue_open_date,
    issueCloseDate: row.issue_close_date,
    anchorDate: row.anchor_date,
    basisOfAllotmentDate: row.basis_of_allotment_date,
    refundDate: row.refund_date,
    dematCreditDate: row.demat_credit_date,
    listingDate: row.listing_date,
    finalIssuePrice: toMoney(row.final_issue_price),
    status: assertLiteral(row.status, IPO_STATUSES, "ipo_issues.status"),
    linkedInstrumentId: row.linked_instrument_id,
    linkedConfirmedAt: row.linked_confirmed_at,
    sourceOrganization: assertLiteral(
      row.source_organization,
      IPO_SOURCE_ORGANIZATIONS,
      "ipo_issues.source_organization",
    ),
    sourceUrl: row.source_url,
    addedByUserId: row.added_by_user_id,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type IpoStatusHistoryEntry = {
  id: string;
  ipoIssueId: string;
  previousStatus: IpoStatus | null;
  newStatus: IpoStatus;
  changedByUserId: string | null;
  note: string | null;
  changedAt: string;
};

export function mapIpoStatusHistoryRow(
  row: IpoStatusHistoryRow,
): IpoStatusHistoryEntry {
  return {
    id: row.id,
    ipoIssueId: row.ipo_issue_id,
    previousStatus:
      row.previous_status === null
        ? null
        : assertLiteral(
            row.previous_status,
            IPO_STATUSES,
            "ipo_status_history.previous_status",
          ),
    newStatus: assertLiteral(
      row.new_status,
      IPO_STATUSES,
      "ipo_status_history.new_status",
    ),
    changedByUserId: row.changed_by_user_id,
    note: row.note,
    changedAt: row.changed_at,
  };
}

export type IpoDocument = {
  id: string;
  ipoIssueId: string;
  documentType: IpoDocumentType;
  title: string;
  filingDate: string | null;
  sourceUrl: string;
  sourceOrganization: IpoSourceOrganization;
  sourcePageUrl: string | null;
  contentHash: string | null;
  retrievedAt: string | null;
  isVerified: boolean;
  supersedesDocumentId: string | null;
  addedByUserId: string;
  createdAt: string;
};

export function mapIpoDocumentRow(row: IpoDocumentRow): IpoDocument {
  return {
    id: row.id,
    ipoIssueId: row.ipo_issue_id,
    documentType: assertLiteral(
      row.document_type,
      IPO_DOCUMENT_TYPES,
      "ipo_documents.document_type",
    ),
    title: row.title,
    filingDate: row.filing_date,
    sourceUrl: row.source_url,
    sourceOrganization: assertLiteral(
      row.source_organization,
      IPO_SOURCE_ORGANIZATIONS,
      "ipo_documents.source_organization",
    ),
    sourcePageUrl: row.source_page_url,
    contentHash: row.content_hash,
    retrievedAt: row.retrieved_at,
    isVerified: row.is_verified,
    supersedesDocumentId: row.supersedes_document_id,
    addedByUserId: row.added_by_user_id,
    createdAt: row.created_at,
  };
}

export type IpoFinancialMetric = {
  id: string;
  ipoIssueId: string;
  metricKey: IpoMetricKey;
  fiscalPeriodEnd: string;
  statementBasis: IpoStatementBasis;
  value: Money;
  unitScale: IpoUnitScale;
  currency: string;
  sourceDocumentId: string | null;
  sourceCitation: string | null;
  extractionMethod: IpoExtractionMethod;
  humanVerified: boolean;
};

export function mapIpoFinancialMetricRow(
  row: IpoFinancialMetricRow,
): IpoFinancialMetric {
  return {
    id: row.id,
    ipoIssueId: row.ipo_issue_id,
    metricKey: assertLiteral(
      row.metric_key,
      IPO_METRIC_KEYS,
      "ipo_financial_metrics.metric_key",
    ),
    fiscalPeriodEnd: row.fiscal_period_end,
    statementBasis: assertLiteral(
      row.statement_basis,
      IPO_STATEMENT_BASES,
      "ipo_financial_metrics.statement_basis",
    ),
    value: new Decimal(row.value),
    unitScale: assertLiteral(
      row.unit_scale,
      IPO_UNIT_SCALES,
      "ipo_financial_metrics.unit_scale",
    ),
    currency: row.currency,
    sourceDocumentId: row.source_document_id,
    sourceCitation: row.source_citation,
    extractionMethod: assertLiteral(
      row.extraction_method,
      IPO_EXTRACTION_METHODS,
      "ipo_financial_metrics.extraction_method",
    ),
    humanVerified: row.human_verified,
  };
}

export type IpoWatchlistItem = {
  id: string;
  userId: string;
  ipoIssueId: string;
  priority: IpoResearchPriority;
  researchStatus: IpoResearchStatus;
  targetReviewDate: string | null;
  addedAt: string;
};

export function mapIpoWatchlistItemRow(
  row: IpoWatchlistItemRow,
): IpoWatchlistItem {
  return {
    id: row.id,
    userId: row.user_id,
    ipoIssueId: row.ipo_issue_id,
    priority: assertLiteral(
      row.priority,
      IPO_RESEARCH_PRIORITIES,
      "ipo_watchlist_items.priority",
    ),
    researchStatus: assertLiteral(
      row.research_status,
      IPO_RESEARCH_STATUSES,
      "ipo_watchlist_items.research_status",
    ),
    targetReviewDate: row.target_review_date,
    addedAt: row.added_at,
  };
}

export type IpoResearchNote = {
  id: string;
  userId: string;
  ipoIssueId: string;
  businessOverview: string | null;
  revenueModel: string | null;
  industryContext: string | null;
  promotersManagement: string | null;
  useOfProceeds: string | null;
  strengths: string | null;
  risks: string | null;
  materialLitigations: string | null;
  relatedPartyConcerns: string | null;
  concentrationRisk: string | null;
  debtNotes: string | null;
  cashFlowNotes: string | null;
  dilutionNotes: string | null;
  valuationObservations: string | null;
  unansweredQuestions: string | null;
  personalNote: string | null;
  riskChecklist: IpoChecklistItem[];
  sourceChecklist: IpoChecklistItem[];
  sourceAiJobId: string | null;
  isAiReviewedEdited: boolean;
  updatedAt: string;
};

function toChecklist(value: unknown): IpoChecklistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: IpoChecklistItem[] = [];
  for (const entry of value as unknown[]) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      "id" in entry &&
      "label" in entry &&
      "checked" in entry &&
      typeof entry.id === "string" &&
      typeof entry.label === "string" &&
      typeof entry.checked === "boolean"
    ) {
      items.push({ id: entry.id, label: entry.label, checked: entry.checked });
    }
  }
  return items;
}

export function mapIpoResearchNoteRow(
  row: IpoResearchNoteRow,
): IpoResearchNote {
  return {
    id: row.id,
    userId: row.user_id,
    ipoIssueId: row.ipo_issue_id,
    businessOverview: row.business_overview,
    revenueModel: row.revenue_model,
    industryContext: row.industry_context,
    promotersManagement: row.promoters_management,
    useOfProceeds: row.use_of_proceeds,
    strengths: row.strengths,
    risks: row.risks,
    materialLitigations: row.material_litigations,
    relatedPartyConcerns: row.related_party_concerns,
    concentrationRisk: row.concentration_risk,
    debtNotes: row.debt_notes,
    cashFlowNotes: row.cash_flow_notes,
    dilutionNotes: row.dilution_notes,
    valuationObservations: row.valuation_observations,
    unansweredQuestions: row.unanswered_questions,
    personalNote: row.personal_note,
    riskChecklist: toChecklist(row.risk_checklist),
    sourceChecklist: toChecklist(row.source_checklist),
    sourceAiJobId: row.source_ai_job_id,
    isAiReviewedEdited: row.is_ai_reviewed_edited,
    updatedAt: row.updated_at,
  };
}
