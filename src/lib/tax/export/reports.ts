import type { Money } from "@/lib/money/decimal";
import type { CapitalGainLine } from "@/lib/tax/engine/capital-gains";
import { toCsv, type CsvColumn } from "@/lib/tax/export/csv";

/**
 * Every report builder in this file follows the same shape: a plain data
 * array (already fetched/computed by the caller — this module never
 * queries anything itself) plus a small header block every export shares,
 * matching this phase's "every export must include" requirement (title,
 * financial year, assessment year, generated timestamp, currency, rule-
 * set version, completeness state, assumptions, unsupported items,
 * disclaimer). CSV cannot carry a header block and a data table in the
 * same tabular shape without breaking a spreadsheet's column alignment,
 * so the header block is emitted as a small leading section of
 * "key,value" rows, followed by a blank line, followed by the real data
 * table — a common, readable convention for annotated CSV exports.
 */

export type ExportHeader = {
  title: string;
  financialYearId: string;
  assessmentYearId: string;
  generatedAt: string;
  currency: string;
  ruleSetVersion: string;
  completenessStatus: string;
  assumptions: string[];
  unsupportedItems: string[];
};

export const TAX_EXPORT_DISCLAIMER =
  "For review and planning only — this is not an income-tax return, not a guarantee of statutory accuracy, and not professional tax advice. Verify every figure against your own official records (Form 16, AIS/TIS, Form 26AS, broker contract notes) and consult a qualified professional where needed.";
const DISCLAIMER = TAX_EXPORT_DISCLAIMER;

function renderHeaderBlock(header: ExportHeader): string {
  const lines: string[] = [];
  lines.push(`"PENRA — ${header.title}"`);
  lines.push(`"Financial year",${header.financialYearId}`);
  lines.push(`"Assessment year",${header.assessmentYearId}`);
  lines.push(`"Generated at",${header.generatedAt}`);
  lines.push(`"Currency",${header.currency}`);
  lines.push(`"Rule-set version",${header.ruleSetVersion}`);
  lines.push(`"Completeness",${header.completenessStatus}`);
  for (const assumption of header.assumptions) {
    lines.push(`"Assumption","${assumption.replace(/"/g, '""')}"`);
  }
  for (const item of header.unsupportedItems) {
    lines.push(`"Unsupported/excluded item","${item.replace(/"/g, '""')}"`);
  }
  lines.push(`"Disclaimer","${DISCLAIMER}"`);
  lines.push("");
  return lines.join("\r\n") + "\r\n";
}

function withHeader(header: ExportHeader, body: string): string {
  return renderHeaderBlock(header) + body;
}

export type IncomeSummaryRow = {
  category: string;
  grossAmount: Money;
  tdsAmount: Money;
  netAmount: Money;
  isExemptCandidate: boolean;
  sourceReference: string;
};

export function buildIncomeSummaryCsv(
  header: ExportHeader,
  rows: IncomeSummaryRow[],
): string {
  const columns: CsvColumn<IncomeSummaryRow>[] = [
    { header: "Category", value: (r) => r.category },
    { header: "Gross amount", value: (r) => r.grossAmount.toString() },
    { header: "TDS", value: (r) => r.tdsAmount.toString() },
    { header: "Net amount", value: (r) => r.netAmount.toString() },
    {
      header: "Exempt-income candidate",
      value: (r) => (r.isExemptCandidate ? "Yes" : "No"),
    },
    { header: "Source reference", value: (r) => r.sourceReference },
  ];
  return withHeader(header, toCsv(rows, columns));
}

export type InterestReportRow = {
  category: string;
  sourceName: string;
  grossAmount: Money;
  tdsAmount: Money;
  netAmount: Money;
  sourceReference: string;
};

export function buildInterestReportCsv(
  header: ExportHeader,
  rows: InterestReportRow[],
): string {
  const columns: CsvColumn<InterestReportRow>[] = [
    { header: "Category", value: (r) => r.category },
    { header: "Source", value: (r) => r.sourceName },
    { header: "Gross interest", value: (r) => r.grossAmount.toString() },
    { header: "TDS", value: (r) => r.tdsAmount.toString() },
    { header: "Net interest", value: (r) => r.netAmount.toString() },
    { header: "Source reference", value: (r) => r.sourceReference },
  ];
  return withHeader(header, toCsv(rows, columns));
}

export type DividendReportRow = {
  instrumentName: string;
  paymentDate: string;
  grossDividend: Money;
  tdsAmount: Money;
  netReceipt: Money;
  hasEvidenceGap: boolean;
  sourceReference: string;
};

export function buildDividendReportCsv(
  header: ExportHeader,
  rows: DividendReportRow[],
): string {
  const columns: CsvColumn<DividendReportRow>[] = [
    { header: "Instrument", value: (r) => r.instrumentName },
    { header: "Payment date", value: (r) => r.paymentDate },
    { header: "Gross dividend", value: (r) => r.grossDividend.toString() },
    { header: "TDS", value: (r) => r.tdsAmount.toString() },
    { header: "Net receipt", value: (r) => r.netReceipt.toString() },
    {
      header: "Missing gross/TDS evidence",
      value: (r) => (r.hasEvidenceGap ? "Yes" : "No"),
    },
    { header: "Source reference", value: (r) => r.sourceReference },
  ];
  return withHeader(header, toCsv(rows, columns));
}

export function buildCapitalGainsCsv(
  header: ExportHeader,
  rows: CapitalGainLine[],
): string {
  const columns: CsvColumn<CapitalGainLine>[] = [
    { header: "Instrument", value: (r) => r.displayName },
    { header: "ISIN/Symbol", value: (r) => r.isinOrSymbol ?? "" },
    { header: "Asset class", value: (r) => r.assetClass },
    { header: "Acquisition date", value: (r) => r.acquisitionDate },
    { header: "Disposal date", value: (r) => r.disposalDate },
    { header: "Units", value: (r) => r.quantity.toString() },
    { header: "Gross proceeds", value: (r) => r.grossProceeds.toString() },
    { header: "Acquisition cost", value: (r) => r.acquisitionCost.toString() },
    {
      header: "Transfer expenses",
      value: (r) => r.transferExpenses.toString(),
    },
    { header: "Gain/loss", value: (r) => r.rawGain.toString() },
    {
      header: "Holding period (days)",
      value: (r) => String(r.holdingPeriodDays),
    },
    { header: "Term", value: (r) => r.term },
    {
      header: "Applied rate (%)",
      value: (r) => r.ratePercent?.toString() ?? "",
    },
    { header: "Rule matched", value: (r) => (r.ruleMatched ? "Yes" : "No") },
    { header: "Source disposal", value: (r) => r.disposalActivityId },
    { header: "Source lot", value: (r) => r.lotId },
  ];
  return withHeader(header, toCsv(rows, columns));
}

export type DeductionSummaryRow = {
  section: string;
  claimedAmount: Money;
  eligibleAmountOld: Money;
  eligibleAmountNew: Money;
  excludedAmount: Money;
  exclusionReason: string;
  evidenceLabel: string;
  status: string;
};

export function buildDeductionSummaryCsv(
  header: ExportHeader,
  rows: DeductionSummaryRow[],
): string {
  const columns: CsvColumn<DeductionSummaryRow>[] = [
    { header: "Section", value: (r) => r.section },
    { header: "Claimed amount", value: (r) => r.claimedAmount.toString() },
    {
      header: "Eligible (old regime)",
      value: (r) => r.eligibleAmountOld.toString(),
    },
    {
      header: "Eligible (new regime)",
      value: (r) => r.eligibleAmountNew.toString(),
    },
    { header: "Excluded amount", value: (r) => r.excludedAmount.toString() },
    { header: "Exclusion reason", value: (r) => r.exclusionReason },
    { header: "Evidence", value: (r) => r.evidenceLabel },
    { header: "Status", value: (r) => r.status },
  ];
  return withHeader(header, toCsv(rows, columns));
}

export type TdsPaymentSummaryRow = {
  recordType: string;
  sourceName: string;
  grossAmount: Money;
  taxAmount: Money;
  date: string;
  referenceLabel: string;
  reconciliationStatus: string;
};

export function buildTdsPaymentSummaryCsv(
  header: ExportHeader,
  rows: TdsPaymentSummaryRow[],
): string {
  const columns: CsvColumn<TdsPaymentSummaryRow>[] = [
    { header: "Type", value: (r) => r.recordType },
    { header: "Source/deductor", value: (r) => r.sourceName },
    { header: "Gross amount", value: (r) => r.grossAmount.toString() },
    { header: "Tax amount", value: (r) => r.taxAmount.toString() },
    { header: "Date", value: (r) => r.date },
    { header: "Reference", value: (r) => r.referenceLabel },
    { header: "Reconciliation status", value: (r) => r.reconciliationStatus },
  ];
  return withHeader(header, toCsv(rows, columns));
}

export type ReconciliationExportRow = {
  source: string;
  incomeCategory: string;
  reportedAmount: string;
  processedAmount: string;
  penraAmount: string;
  acceptedAmount: string;
  status: string;
  explanation: string;
};

export function buildReconciliationCsv(
  header: ExportHeader,
  rows: ReconciliationExportRow[],
): string {
  const columns: CsvColumn<ReconciliationExportRow>[] = [
    { header: "Source", value: (r) => r.source },
    { header: "Income category", value: (r) => r.incomeCategory },
    { header: "Reported", value: (r) => r.reportedAmount },
    { header: "Processed", value: (r) => r.processedAmount },
    { header: "PENRA figure", value: (r) => r.penraAmount },
    { header: "Accepted value", value: (r) => r.acceptedAmount },
    { header: "Status", value: (r) => r.status },
    { header: "Explanation", value: (r) => r.explanation },
  ];
  return withHeader(header, toCsv(rows, columns));
}
