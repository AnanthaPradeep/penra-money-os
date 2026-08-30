import { Decimal, type Money } from "@/lib/money/decimal";
import { assertLiteral } from "@/lib/types/literal";
import type {
  TaxAssetClassificationRow,
  TaxDeductionRow,
  TaxIncomeAdjustmentRow,
  TaxPaymentRow,
  TaxProfileRow,
  TaxReconciliationItemRow,
  TaxReportSnapshotRow,
  TaxWithholdingRow,
} from "@/lib/tax/types";

export const TAXPAYER_TYPES = ["individual"] as const;
export type TaxpayerType = (typeof TAXPAYER_TYPES)[number];

export const RESIDENTIAL_STATUSES = [
  "resident",
  "non_resident",
  "resident_not_ordinarily_resident",
] as const;
export type ResidentialStatus = (typeof RESIDENTIAL_STATUSES)[number];

export const AGE_BANDS = ["below_60", "60_to_80", "above_80"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const TAX_REGIMES = ["old", "new"] as const;
export type TaxRegimePreference = (typeof TAX_REGIMES)[number];

export type TaxProfile = {
  id: string;
  taxpayerType: TaxpayerType;
  residentialStatus: ResidentialStatus;
  hasBusinessOrProfessionalIncome: boolean;
  hasSalaryOrPensionIncome: boolean;
  defaultRegimePreference: TaxRegimePreference | null;
  ageBand: AgeBand | null;
  maskedPanLabel: string | null;
  notes: string | null;
  updatedAt: string;
};

export function mapTaxProfileRow(row: TaxProfileRow): TaxProfile {
  return {
    id: row.id,
    taxpayerType: assertLiteral(
      row.taxpayer_type,
      TAXPAYER_TYPES,
      "tax_profiles.taxpayer_type",
    ),
    residentialStatus: assertLiteral(
      row.residential_status,
      RESIDENTIAL_STATUSES,
      "tax_profiles.residential_status",
    ),
    hasBusinessOrProfessionalIncome: row.has_business_or_professional_income,
    hasSalaryOrPensionIncome: row.has_salary_or_pension_income,
    defaultRegimePreference:
      row.default_regime_preference === null
        ? null
        : assertLiteral(
            row.default_regime_preference,
            TAX_REGIMES,
            "tax_profiles.default_regime_preference",
          ),
    ageBand:
      row.age_band === null
        ? null
        : assertLiteral(row.age_band, AGE_BANDS, "tax_profiles.age_band"),
    maskedPanLabel: row.masked_pan_label,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

/** Whether this profile falls within the automated calculator's supported scope — see src/lib/tax/rules/registry.ts's SUPPORTED_TAXPAYER_SCOPE. */
export function isProfileWithinSupportedScope(profile: TaxProfile): boolean {
  return (
    profile.taxpayerType === "individual" &&
    profile.residentialStatus === "resident" &&
    !profile.hasBusinessOrProfessionalIncome
  );
}

export const INCOME_CATEGORIES = [
  "salary",
  "savings_interest",
  "fd_interest",
  "rd_interest",
  "ppf_interest",
  "dividend",
  "refund_interest",
  "other_taxable_interest",
  "other_income",
] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  salary: "Salary/pension",
  savings_interest: "Savings account interest",
  fd_interest: "Fixed deposit interest",
  rd_interest: "Recurring deposit interest",
  ppf_interest: "PPF interest",
  dividend: "Dividend",
  refund_interest: "Income-tax refund interest",
  other_taxable_interest: "Other taxable interest",
  other_income: "Other income",
};

export const INCOME_SOURCE_TYPES = [
  "manual",
  "ledger_transaction",
  "investment_activity",
] as const;
export type IncomeSourceType = (typeof INCOME_SOURCE_TYPES)[number];

export const INCOME_ADJUSTMENT_STATUSES = ["draft", "confirmed"] as const;
export type IncomeAdjustmentStatus =
  (typeof INCOME_ADJUSTMENT_STATUSES)[number];

export type TaxIncomeAdjustment = {
  id: string;
  financialYearId: string;
  category: IncomeCategory;
  grossAmount: Money;
  tdsAmount: Money;
  netAmount: Money;
  currency: string;
  isExemptCandidate: boolean;
  sourceType: IncomeSourceType;
  sourceLedgerTransactionId: string | null;
  sourceInvestmentActivityId: string | null;
  evidenceLabel: string | null;
  notes: string | null;
  status: IncomeAdjustmentStatus;
};

export function mapTaxIncomeAdjustmentRow(
  row: TaxIncomeAdjustmentRow,
): TaxIncomeAdjustment {
  const gross = new Decimal(row.gross_amount);
  const tds = new Decimal(row.tds_amount);
  return {
    id: row.id,
    financialYearId: row.financial_year_id,
    category: assertLiteral(
      row.category,
      INCOME_CATEGORIES,
      "tax_income_adjustments.category",
    ),
    grossAmount: gross,
    tdsAmount: tds,
    netAmount: gross.minus(tds),
    currency: row.currency,
    isExemptCandidate: row.is_exempt_candidate,
    sourceType: assertLiteral(
      row.source_type,
      INCOME_SOURCE_TYPES,
      "tax_income_adjustments.source_type",
    ),
    sourceLedgerTransactionId: row.source_ledger_transaction_id,
    sourceInvestmentActivityId: row.source_investment_activity_id,
    evidenceLabel: row.evidence_label,
    notes: row.notes,
    status: assertLiteral(
      row.status,
      INCOME_ADJUSTMENT_STATUSES,
      "tax_income_adjustments.status",
    ),
  };
}

export const DEDUCTION_STATUSES = ["draft", "confirmed"] as const;
export type DeductionStatus = (typeof DEDUCTION_STATUSES)[number];

export type TaxDeduction = {
  id: string;
  financialYearId: string;
  section: string;
  claimedAmount: Money;
  evidenceLabel: string | null;
  maskedReference: string | null;
  sourceUrl: string | null;
  notes: string | null;
  status: DeductionStatus;
};

export function mapTaxDeductionRow(row: TaxDeductionRow): TaxDeduction {
  return {
    id: row.id,
    financialYearId: row.financial_year_id,
    section: row.section,
    claimedAmount: new Decimal(row.claimed_amount),
    evidenceLabel: row.evidence_label,
    maskedReference: row.masked_reference,
    sourceUrl: row.source_url,
    notes: row.notes,
    status: assertLiteral(
      row.status,
      DEDUCTION_STATUSES,
      "tax_deductions.status",
    ),
  };
}

export const WITHHOLDING_TYPES = [
  "salary_tds",
  "interest_tds",
  "dividend_tds",
  "other_tds",
  "tcs",
] as const;
export type WithholdingType = (typeof WITHHOLDING_TYPES)[number];

export const WITHHOLDING_TYPE_LABELS: Record<WithholdingType, string> = {
  salary_tds: "Salary TDS",
  interest_tds: "Interest TDS",
  dividend_tds: "Dividend TDS",
  other_tds: "Other TDS",
  tcs: "TCS",
};

export const WITHHOLDING_RECONCILIATION_STATUSES = [
  "unreviewed",
  "matched",
  "difference",
  "user_confirmed",
] as const;
export type WithholdingReconciliationStatus =
  (typeof WITHHOLDING_RECONCILIATION_STATUSES)[number];

export type TaxWithholding = {
  id: string;
  financialYearId: string;
  withholdingType: WithholdingType;
  deductorName: string;
  maskedTan: string | null;
  incomeCategory: string | null;
  grossAmount: Money;
  taxWithheld: Money;
  withheldOn: string;
  referenceLabel: string | null;
  evidenceSource: string | null;
  reconciliationStatus: WithholdingReconciliationStatus;
  notes: string | null;
};

export function mapTaxWithholdingRow(row: TaxWithholdingRow): TaxWithholding {
  return {
    id: row.id,
    financialYearId: row.financial_year_id,
    withholdingType: assertLiteral(
      row.withholding_type,
      WITHHOLDING_TYPES,
      "tax_withholdings.withholding_type",
    ),
    deductorName: row.deductor_name,
    maskedTan: row.masked_tan,
    incomeCategory: row.income_category,
    grossAmount: new Decimal(row.gross_amount),
    taxWithheld: new Decimal(row.tax_withheld),
    withheldOn: row.withheld_on,
    referenceLabel: row.reference_label,
    evidenceSource: row.evidence_source,
    reconciliationStatus: assertLiteral(
      row.reconciliation_status,
      WITHHOLDING_RECONCILIATION_STATUSES,
      "tax_withholdings.reconciliation_status",
    ),
    notes: row.notes,
  };
}

export const TAX_PAYMENT_TYPES = [
  "advance_tax",
  "self_assessment_tax",
  "refund",
] as const;
export type TaxPaymentType = (typeof TAX_PAYMENT_TYPES)[number];

export const TAX_PAYMENT_TYPE_LABELS: Record<TaxPaymentType, string> = {
  advance_tax: "Advance tax",
  self_assessment_tax: "Self-assessment tax",
  refund: "Refund received",
};

export type TaxPayment = {
  id: string;
  financialYearId: string;
  paymentType: TaxPaymentType;
  amount: Money;
  paidOn: string;
  challanReference: string | null;
  relatedTransactionId: string | null;
  notes: string | null;
};

export function mapTaxPaymentRow(row: TaxPaymentRow): TaxPayment {
  return {
    id: row.id,
    financialYearId: row.financial_year_id,
    paymentType: assertLiteral(
      row.payment_type,
      TAX_PAYMENT_TYPES,
      "tax_payments.payment_type",
    ),
    amount: new Decimal(row.amount),
    paidOn: row.paid_on,
    challanReference: row.challan_reference,
    relatedTransactionId: row.related_transaction_id,
    notes: row.notes,
  };
}

export const TAX_ASSET_CLASSES = [
  "listed_equity",
  "equity_oriented_mutual_fund",
  "unsupported",
] as const;
export type TaxAssetClass = (typeof TAX_ASSET_CLASSES)[number];

export const TAX_ASSET_CLASS_LABELS: Record<TaxAssetClass, string> = {
  listed_equity: "Listed equity",
  equity_oriented_mutual_fund: "Equity-oriented mutual fund",
  unsupported: "Unsupported for automated capital gains",
};

export type TaxAssetClassification = {
  id: string;
  investmentAssetId: string;
  assetClass: TaxAssetClass;
  unsupportedReason: string | null;
  confirmedAt: string;
  notes: string | null;
};

export function mapTaxAssetClassificationRow(
  row: TaxAssetClassificationRow,
): TaxAssetClassification {
  return {
    id: row.id,
    investmentAssetId: row.investment_asset_id,
    assetClass: assertLiteral(
      row.asset_class,
      TAX_ASSET_CLASSES,
      "tax_asset_classifications.asset_class",
    ),
    unsupportedReason: row.unsupported_reason,
    confirmedAt: row.confirmed_at,
    notes: row.notes,
  };
}

export const RECONCILIATION_SOURCES = ["ais", "form_26as"] as const;
export type ReconciliationSource = (typeof RECONCILIATION_SOURCES)[number];

export const RECONCILIATION_SOURCE_LABELS: Record<
  ReconciliationSource,
  string
> = {
  ais: "AIS/TIS",
  form_26as: "Form 26AS",
};

export const RECONCILIATION_STATUSES = [
  "unreviewed",
  "matched",
  "difference",
  "missing_in_penra",
  "missing_in_statement",
  "user_confirmed",
  "not_applicable",
] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export type TaxReconciliationItem = {
  id: string;
  financialYearId: string;
  source: ReconciliationSource;
  incomeCategory: string;
  reportedAmount: Money | null;
  processedAmount: Money | null;
  penraAmount: Money | null;
  acceptedAmount: Money | null;
  status: ReconciliationStatus;
  explanation: string | null;
  evidenceSource: string | null;
  evidenceDate: string | null;
  lastReviewedAt: string | null;
};

export function mapTaxReconciliationItemRow(
  row: TaxReconciliationItemRow,
): TaxReconciliationItem {
  return {
    id: row.id,
    financialYearId: row.financial_year_id,
    source: assertLiteral(
      row.source,
      RECONCILIATION_SOURCES,
      "tax_reconciliation_items.source",
    ),
    incomeCategory: row.income_category,
    reportedAmount:
      row.reported_amount === null ? null : new Decimal(row.reported_amount),
    processedAmount:
      row.processed_amount === null ? null : new Decimal(row.processed_amount),
    penraAmount:
      row.penra_amount === null ? null : new Decimal(row.penra_amount),
    acceptedAmount:
      row.accepted_amount === null ? null : new Decimal(row.accepted_amount),
    status: assertLiteral(
      row.status,
      RECONCILIATION_STATUSES,
      "tax_reconciliation_items.status",
    ),
    explanation: row.explanation,
    evidenceSource: row.evidence_source,
    evidenceDate: row.evidence_date,
    lastReviewedAt: row.last_reviewed_at,
  };
}

export const SNAPSHOT_STATUSES = [
  "draft",
  "needs_review",
  "ready",
  "finalized",
  "superseded",
] as const;
export type SnapshotStatus = (typeof SNAPSHOT_STATUSES)[number];

export const COMPLETENESS_STATUSES = [
  "complete",
  "partial",
  "unavailable",
  "stale",
] as const;
export type CompletenessStatus = (typeof COMPLETENESS_STATUSES)[number];

export type TaxReportSnapshot = {
  id: string;
  financialYearId: string;
  assessmentYearId: string;
  ruleSetVersion: string;
  status: SnapshotStatus;
  completenessStatus: CompletenessStatus;
  snapshotData: unknown;
  warnings: string[];
  supersedesSnapshotId: string | null;
  supersededBy: string | null;
  generatedAt: string;
  finalizedAt: string | null;
};

export function mapTaxReportSnapshotRow(
  row: TaxReportSnapshotRow,
): TaxReportSnapshot {
  const warnings = Array.isArray(row.warnings)
    ? row.warnings.filter((w): w is string => typeof w === "string")
    : [];
  return {
    id: row.id,
    financialYearId: row.financial_year_id,
    assessmentYearId: row.assessment_year_id,
    ruleSetVersion: row.rule_set_version,
    status: assertLiteral(
      row.status,
      SNAPSHOT_STATUSES,
      "tax_report_snapshots.status",
    ),
    completenessStatus: assertLiteral(
      row.completeness_status,
      COMPLETENESS_STATUSES,
      "tax_report_snapshots.completeness_status",
    ),
    snapshotData: row.snapshot_data,
    warnings,
    supersedesSnapshotId: row.supersedes_snapshot_id,
    supersededBy: row.superseded_by,
    generatedAt: row.generated_at,
    finalizedAt: row.finalized_at,
  };
}
