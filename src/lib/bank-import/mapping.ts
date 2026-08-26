import { z } from "zod";

import { isCreditCardType, type UserAccountType } from "@/lib/accounts/classes";
import { Decimal, type Money } from "@/lib/money/decimal";
import { isOneOf, assertLiteral } from "@/lib/types/literal";
import {
  STATEMENT_DATE_FORMATS,
  type AmountColumnShape,
  type AmountSignConvention,
  type ColumnDetectionResult,
  type ImportableTransactionType,
  type MatchConfidence,
  type MatchKind,
  type ReconciliationStatus,
  type RowDirection,
  type RowDuplicateStatus,
  type RowMatchStatus,
  type RowPostingResult,
  type RowUserDecision,
  type RowValidationError,
  type RuleMatchField,
  type StatementColumnMapping,
  type StatementFileFormat,
  type StatementImportStatus,
} from "@/lib/bank-import/types";
import type { Database } from "@/types/database.types";

type StatementImportRowDb =
  Database["public"]["Tables"]["statement_imports"]["Row"];
type StatementImportRowRowDb =
  Database["public"]["Tables"]["statement_import_rows"]["Row"];
type StatementColumnMappingRowDb =
  Database["public"]["Tables"]["statement_column_mappings"]["Row"];
type StatementImportRuleRowDb =
  Database["public"]["Tables"]["statement_import_rules"]["Row"];
type StatementImportRowMatchRowDb =
  Database["public"]["Tables"]["statement_import_row_matches"]["Row"];

const IMPORT_STATUSES = [
  "uploaded",
  "mapping_required",
  "parsed",
  "reviewing",
  "ready",
  "posting",
  "completed",
  "failed",
  "discarded",
] as const;
const RECONCILIATION_STATUSES = [
  "not_started",
  "in_progress",
  "balanced",
  "difference",
  "incomplete",
] as const;
const IMPORTABLE_TRANSACTION_TYPES = [
  "income",
  "expense",
  "transfer",
  "credit_card_purchase",
  "credit_card_payment",
] as const;
const ROW_DUPLICATE_STATUSES = [
  "not_duplicate",
  "exact_file_duplicate",
  "exact_row_duplicate",
  "existing_transaction_match",
  "possible_duplicate",
] as const;
const ROW_MATCH_STATUSES = [
  "unmatched",
  "existing_match_candidate",
  "existing_match_confirmed",
  "transfer_candidate",
  "transfer_confirmed",
] as const;
const ROW_USER_DECISIONS = ["pending", "include", "exclude"] as const;
const ROW_POSTING_RESULTS = [
  "created",
  "linked",
  "transfer_created",
  "transfer_linked",
] as const;
const ROW_DIRECTIONS = ["debit", "credit"] as const;
const MATCH_CONFIDENCES = ["high", "medium", "low"] as const;
const MATCH_KINDS = ["existing_transaction", "transfer_row"] as const;
const RULE_MATCH_FIELDS = [
  "description_contains",
  "description_starts_with",
  "description_exact",
  "reference_prefix",
] as const;

/**
 * Runtime-validated shape for a jsonb column read back from the database
 * — the generated `Json` type is intentionally opaque, so every jsonb
 * column is parsed through a schema here rather than asserted with `as
 * unknown as`. A malformed value (which should never happen, since only
 * our own RPCs ever write these columns) degrades to an empty array
 * rather than crashing the page that reads it.
 */
const ROW_VALIDATION_ERROR_CODES = [
  "missing_date",
  "invalid_date",
  "ambiguous_date",
  "future_date",
  "missing_description",
  "missing_amount",
  "invalid_amount",
  "both_debit_and_credit",
  "neither_debit_nor_credit",
  "zero_amount",
  "field_too_long",
  "control_characters",
  "currency_mismatch",
] as const;
const rowValidationErrorSchema = z.object({
  code: z.enum(ROW_VALIDATION_ERROR_CODES),
  message: z.string(),
  field: z.string().optional(),
});
const rowValidationErrorsSchema = z.array(rowValidationErrorSchema).catch([]);

function parseValidationErrors(value: unknown): RowValidationError[] {
  // Rebuilt field-by-field (rather than trusting Zod's inferred output
  // directly) because exactOptionalPropertyTypes distinguishes "field is
  // absent" from "field is present and undefined" — Zod's .optional()
  // produces the latter, RowValidationError requires the former.
  return rowValidationErrorsSchema.parse(value).map((item) => ({
    code: item.code,
    message: item.message,
    ...(item.field !== undefined ? { field: item.field } : {}),
  }));
}

const stringArraySchema = z.array(z.string()).catch([]);

function parseStringArray(value: unknown): string[] {
  return stringArraySchema.parse(value);
}

export type StatementImport = {
  id: string;
  accountId: string;
  originalFilename: string;
  fileHash: string;
  fileFormat: StatementFileFormat;
  fileSizeBytes: number;
  detectedDelimiter: string;
  headerFingerprint: string;
  mapping: StatementColumnMapping | null;
  currency: string;
  statementStartDate: string | null;
  statementEndDate: string | null;
  openingBalance: Money | null;
  closingBalance: Money | null;
  expectedClosingBalance: Money | null;
  reconciliationStatus: ReconciliationStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  excludedRows: number;
  duplicateRows: number;
  matchedRows: number;
  importedRows: number;
  status: StatementImportStatus;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
};

export function mapStatementImportRow(
  row: StatementImportRowDb,
): StatementImport {
  const mapping = toColumnMapping(row);
  return {
    id: row.id,
    accountId: row.account_id,
    originalFilename: row.original_filename,
    fileHash: row.file_hash,
    fileFormat: assertLiteral(
      row.file_format,
      ["csv", "tsv"] as const,
      "statement_imports.file_format",
    ),
    fileSizeBytes: row.file_size_bytes,
    detectedDelimiter: row.detected_delimiter,
    headerFingerprint: row.header_fingerprint,
    mapping,
    currency: row.currency,
    statementStartDate: row.statement_start_date,
    statementEndDate: row.statement_end_date,
    openingBalance:
      row.opening_balance === null ? null : new Decimal(row.opening_balance),
    closingBalance:
      row.closing_balance === null ? null : new Decimal(row.closing_balance),
    expectedClosingBalance:
      row.expected_closing_balance === null
        ? null
        : new Decimal(row.expected_closing_balance),
    reconciliationStatus: assertLiteral(
      row.reconciliation_status,
      RECONCILIATION_STATUSES,
      "statement_imports.reconciliation_status",
    ),
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    invalidRows: row.invalid_rows,
    excludedRows: row.excluded_rows,
    duplicateRows: row.duplicate_rows,
    matchedRows: row.matched_rows,
    importedRows: row.imported_rows,
    status: assertLiteral(
      row.status,
      IMPORT_STATUSES,
      "statement_imports.status",
    ),
    errorCode: row.error_code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function toColumnMapping(
  row: StatementImportRowDb,
): StatementColumnMapping | null {
  if (!row.date_column || !row.description_column || !row.date_format) {
    return null;
  }
  if (!isOneOf(row.date_format, STATEMENT_DATE_FORMATS)) {
    return null;
  }
  const signConvention: AmountSignConvention =
    row.amount_sign_convention === "debit_positive"
      ? "debit_positive"
      : "debit_negative";
  return {
    dateColumn: row.date_column,
    ...(row.value_date_column
      ? { valueDateColumn: row.value_date_column }
      : {}),
    descriptionColumn: row.description_column,
    ...(row.reference_column ? { referenceColumn: row.reference_column } : {}),
    ...(row.debit_column ? { debitColumn: row.debit_column } : {}),
    ...(row.credit_column ? { creditColumn: row.credit_column } : {}),
    ...(row.amount_column ? { amountColumn: row.amount_column } : {}),
    ...(row.transaction_type_column
      ? { transactionTypeColumn: row.transaction_type_column }
      : {}),
    ...(row.balance_column ? { balanceColumn: row.balance_column } : {}),
    dateFormat: row.date_format,
    amountSignConvention: signConvention,
  };
}

/** Which amount shape a mapping uses — mirrors statement_column_mappings_has_amount_source's either/or. */
export function amountShapeForMapping(
  mapping: Pick<
    StatementColumnMapping,
    "debitColumn" | "creditColumn" | "amountColumn"
  >,
): AmountColumnShape {
  return mapping.debitColumn || mapping.creditColumn
    ? "debit_credit_columns"
    : "signed_amount_column";
}

export type StatementImportRowDomain = {
  id: string;
  importId: string;
  accountId: string;
  rowIndex: number;
  transactionDate: string | null;
  valueDate: string | null;
  description: string;
  reference: string | null;
  chequeNumber: string | null;
  amount: Money | null;
  direction: RowDirection | null;
  runningBalance: Money | null;
  currency: string;
  suggestedTransactionType: ImportableTransactionType | null;
  resolvedTransactionType: ImportableTransactionType | null;
  suggestedCategoryId: string | null;
  suggestedPayeeId: string | null;
  counterpartyAccountId: string | null;
  matchedRuleId: string | null;
  duplicateStatus: RowDuplicateStatus;
  matchStatus: RowMatchStatus;
  userDecision: RowUserDecision;
  validationErrors: RowValidationError[];
  linkedExistingTransactionId: string | null;
  linkedCreatedTransactionId: string | null;
  transferGroupId: string | null;
  postingResult: RowPostingResult | null;
  notes: string | null;
};

export function mapStatementImportRowRow(
  row: StatementImportRowRowDb,
): StatementImportRowDomain {
  return {
    id: row.id,
    importId: row.import_id,
    accountId: row.account_id,
    rowIndex: row.row_index,
    transactionDate: row.transaction_date,
    valueDate: row.value_date,
    description: row.description,
    reference: row.reference,
    chequeNumber: row.cheque_number,
    amount: row.amount === null ? null : new Decimal(row.amount),
    direction:
      row.direction === null
        ? null
        : assertLiteral(
            row.direction,
            ROW_DIRECTIONS,
            "statement_import_rows.direction",
          ),
    runningBalance:
      row.running_balance === null ? null : new Decimal(row.running_balance),
    currency: row.currency,
    suggestedTransactionType:
      row.suggested_transaction_type === null
        ? null
        : assertLiteral(
            row.suggested_transaction_type,
            IMPORTABLE_TRANSACTION_TYPES,
            "statement_import_rows.suggested_transaction_type",
          ),
    resolvedTransactionType:
      row.resolved_transaction_type === null
        ? null
        : assertLiteral(
            row.resolved_transaction_type,
            IMPORTABLE_TRANSACTION_TYPES,
            "statement_import_rows.resolved_transaction_type",
          ),
    suggestedCategoryId: row.suggested_category_id,
    suggestedPayeeId: row.suggested_payee_id,
    counterpartyAccountId: row.counterparty_account_id,
    matchedRuleId: row.matched_rule_id,
    duplicateStatus: assertLiteral(
      row.duplicate_status,
      ROW_DUPLICATE_STATUSES,
      "statement_import_rows.duplicate_status",
    ),
    matchStatus: assertLiteral(
      row.match_status,
      ROW_MATCH_STATUSES,
      "statement_import_rows.match_status",
    ),
    userDecision: assertLiteral(
      row.user_decision,
      ROW_USER_DECISIONS,
      "statement_import_rows.user_decision",
    ),
    validationErrors: parseValidationErrors(row.validation_errors),
    linkedExistingTransactionId: row.linked_existing_transaction_id,
    linkedCreatedTransactionId: row.linked_created_transaction_id,
    transferGroupId: row.transfer_group_id,
    postingResult:
      row.posting_result === null
        ? null
        : assertLiteral(
            row.posting_result,
            ROW_POSTING_RESULTS,
            "statement_import_rows.posting_result",
          ),
    notes: row.notes,
  };
}

export type StatementColumnMappingPreset = {
  id: string;
  headerFingerprint: string;
  bankLabel: string | null;
  mapping: StatementColumnMapping;
};

export function mapColumnMappingPresetRow(
  row: StatementColumnMappingRowDb,
): StatementColumnMappingPreset | null {
  if (!isOneOf(row.date_format, STATEMENT_DATE_FORMATS)) {
    return null;
  }
  return {
    id: row.id,
    headerFingerprint: row.header_fingerprint,
    bankLabel: row.bank_label,
    mapping: {
      dateColumn: row.date_column,
      ...(row.value_date_column
        ? { valueDateColumn: row.value_date_column }
        : {}),
      descriptionColumn: row.description_column,
      ...(row.reference_column
        ? { referenceColumn: row.reference_column }
        : {}),
      ...(row.debit_column ? { debitColumn: row.debit_column } : {}),
      ...(row.credit_column ? { creditColumn: row.credit_column } : {}),
      ...(row.amount_column ? { amountColumn: row.amount_column } : {}),
      ...(row.transaction_type_column
        ? { transactionTypeColumn: row.transaction_type_column }
        : {}),
      ...(row.balance_column ? { balanceColumn: row.balance_column } : {}),
      dateFormat: row.date_format,
      amountSignConvention:
        row.amount_sign_convention === "debit_positive"
          ? "debit_positive"
          : "debit_negative",
    },
  };
}

export type ImportRule = {
  id: string;
  name: string;
  matchField: RuleMatchField;
  matchValue: string;
  directionFilter: RowDirection | null;
  accountId: string | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  suggestedTransactionType: ImportableTransactionType | null;
  suggestedCategoryId: string | null;
  suggestedPayeeId: string | null;
  notesTemplate: string | null;
  exclude: boolean;
  priority: number;
  isActive: boolean;
};

export function mapImportRuleRow(row: StatementImportRuleRowDb): ImportRule {
  return {
    id: row.id,
    name: row.name,
    matchField: assertLiteral(
      row.match_field,
      RULE_MATCH_FIELDS,
      "statement_import_rules.match_field",
    ),
    matchValue: row.match_value,
    directionFilter:
      row.direction_filter === null
        ? null
        : assertLiteral(
            row.direction_filter,
            ROW_DIRECTIONS,
            "statement_import_rules.direction_filter",
          ),
    accountId: row.account_id,
    minAmount: row.min_amount === null ? null : new Decimal(row.min_amount),
    maxAmount: row.max_amount === null ? null : new Decimal(row.max_amount),
    suggestedTransactionType:
      row.suggested_transaction_type === null
        ? null
        : assertLiteral(
            row.suggested_transaction_type,
            IMPORTABLE_TRANSACTION_TYPES,
            "statement_import_rules.suggested_transaction_type",
          ),
    suggestedCategoryId: row.suggested_category_id,
    suggestedPayeeId: row.suggested_payee_id,
    notesTemplate: row.notes_template,
    exclude: row.exclude,
    priority: row.priority,
    isActive: row.is_active,
  };
}

export type RowMatch = {
  id: string;
  importRowId: string;
  candidateTransactionId: string | null;
  candidateRowId: string | null;
  matchKind: MatchKind;
  score: number;
  confidence: MatchConfidence;
  reasons: string[];
  conflicts: string[];
};

export function mapRowMatchRow(row: StatementImportRowMatchRowDb): RowMatch {
  return {
    id: row.id,
    importRowId: row.import_row_id,
    candidateTransactionId: row.candidate_transaction_id,
    candidateRowId: row.candidate_row_id,
    matchKind: assertLiteral(
      row.match_kind,
      MATCH_KINDS,
      "statement_import_row_matches.match_kind",
    ),
    score: row.score,
    confidence: assertLiteral(
      row.confidence,
      MATCH_CONFIDENCES,
      "statement_import_row_matches.confidence",
    ),
    reasons: parseStringArray(row.reasons),
    conflicts: parseStringArray(row.conflicts),
  };
}

/**
 * The base suggested transaction type from a row's own direction and the
 * destination account's type alone — before any rule or transfer match is
 * considered. Bank debit = money-out = expense (or a credit-card purchase,
 * which increases the amount owed); bank credit = money-in = income (or a
 * credit-card payment, which decreases the amount owed). This is always
 * only a *suggestion* — resolved_transaction_type is what actually posts,
 * and a rule match or an explicit transfer/existing-transaction link can
 * still override it before the user confirms.
 */
export function inferBaseTransactionType(
  direction: RowDirection,
  accountType: UserAccountType,
): ImportableTransactionType {
  if (isCreditCardType(accountType)) {
    return direction === "credit"
      ? "credit_card_payment"
      : "credit_card_purchase";
  }
  return direction === "credit" ? "income" : "expense";
}

/**
 * Keyword-based, fully explainable column auto-detection — every
 * suggestion carries the reason it was picked, and the mapping screen
 * always requires the user to confirm (or correct) it before parsing
 * proceeds; nothing here is ever applied silently.
 */
export function detectColumnMapping(header: string[]): ColumnDetectionResult {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const reasons: ColumnDetectionResult["reasons"] = {};
  const suggested: ColumnDetectionResult["suggested"] = {};

  function find(keywords: string[]): string | undefined {
    for (const keyword of keywords) {
      const index = normalized.findIndex((h) => h.includes(keyword));
      if (index !== -1) {
        return header[index];
      }
    }
    return undefined;
  }

  const dateCol = find(["transaction date", "txn date", "value date", "date"]);
  if (dateCol) {
    suggested.dateColumn = dateCol;
    reasons.dateColumn = `Column "${dateCol}" looks like a date column.`;
  }

  const descCol = find([
    "narration",
    "description",
    "particulars",
    "details",
    "remarks",
  ]);
  if (descCol) {
    suggested.descriptionColumn = descCol;
    reasons.descriptionColumn = `Column "${descCol}" looks like a description column.`;
  }

  const refCol = find(["reference", "ref no", "cheque", "chq", "utr"]);
  if (refCol) {
    suggested.referenceColumn = refCol;
    reasons.referenceColumn = `Column "${refCol}" looks like a reference column.`;
  }

  const debitCol = find(["debit", "withdrawal", "dr amount"]);
  if (debitCol) {
    suggested.debitColumn = debitCol;
    reasons.debitColumn = `Column "${debitCol}" looks like a debit column.`;
  }

  const creditCol = find(["credit", "deposit", "cr amount"]);
  if (creditCol) {
    suggested.creditColumn = creditCol;
    reasons.creditColumn = `Column "${creditCol}" looks like a credit column.`;
  }

  if (!debitCol && !creditCol) {
    const amountCol = find(["amount", "value"]);
    if (amountCol) {
      suggested.amountColumn = amountCol;
      reasons.amountColumn = `Column "${amountCol}" looks like a single signed-amount column.`;
    }
  }

  const balanceCol = find(["balance", "closing balance", "running balance"]);
  if (balanceCol) {
    suggested.balanceColumn = balanceCol;
    reasons.balanceColumn = `Column "${balanceCol}" looks like a running-balance column.`;
  }

  const foundCount = Object.keys(suggested).length;
  const hasCore = Boolean(suggested.dateColumn && suggested.descriptionColumn);
  const hasAmount = Boolean(
    suggested.debitColumn || suggested.creditColumn || suggested.amountColumn,
  );

  const confidence: MatchConfidence =
    hasCore && hasAmount && foundCount >= 4
      ? "high"
      : hasCore && hasAmount
        ? "medium"
        : "low";

  return { suggested, confidence, reasons };
}
