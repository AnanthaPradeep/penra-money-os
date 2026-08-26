import type { Money } from "@/lib/money/decimal";

/**
 * Every union here mirrors a `check` constraint in
 * supabase/migrations/20260825154818_phase11_bank_statement_import_v2.sql
 * byte-for-byte — the database is still the authoritative boundary, but
 * keeping these in lockstep means an invalid value is a TypeScript error
 * long before it becomes a Postgres one.
 */

export type StatementFileFormat = "csv" | "tsv";

export type StatementImportStatus =
  | "uploaded"
  | "mapping_required"
  | "parsed"
  | "reviewing"
  | "ready"
  | "posting"
  | "completed"
  | "failed"
  | "discarded";

export type ReconciliationStatus =
  "not_started" | "in_progress" | "balanced" | "difference" | "incomplete";

export type RowDirection = "debit" | "credit";

/** Which shape this statement's amount columns take — mutually exclusive on the mapping form, see mapping.ts's isMappingComplete. */
export type AmountColumnShape = "debit_credit_columns" | "signed_amount_column";

export type AmountSignConvention = "debit_negative" | "debit_positive";

export const STATEMENT_DATE_FORMATS = [
  "DD/MM/YYYY",
  "DD-MM-YYYY",
  "DD/MM/YY",
  "YYYY-MM-DD",
  "DD MMM YYYY",
] as const;
export type StatementDateFormat = (typeof STATEMENT_DATE_FORMATS)[number];

/** The subset of ledger transaction types a bank-statement row can ever resolve to — never "adjustment" or an investment type. */
export type ImportableTransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "credit_card_purchase"
  | "credit_card_payment";

export type RowDuplicateStatus =
  | "not_duplicate"
  | "exact_file_duplicate"
  | "exact_row_duplicate"
  | "existing_transaction_match"
  | "possible_duplicate";

export type RowMatchStatus =
  | "unmatched"
  | "existing_match_candidate"
  | "existing_match_confirmed"
  | "transfer_candidate"
  | "transfer_confirmed";

export type RowUserDecision = "pending" | "include" | "exclude";

export type RowPostingResult =
  "created" | "linked" | "transfer_created" | "transfer_linked";

export type MatchConfidence = "high" | "medium" | "low";
export type MatchKind = "existing_transaction" | "transfer_row";

export type RuleMatchField =
  | "description_contains"
  | "description_starts_with"
  | "description_exact"
  | "reference_prefix";

/** One structured, user-facing reason a row failed validation — never a raw parser/library error string. */
export type RowValidationError = {
  code:
    | "missing_date"
    | "invalid_date"
    | "ambiguous_date"
    | "future_date"
    | "missing_description"
    | "missing_amount"
    | "invalid_amount"
    | "both_debit_and_credit"
    | "neither_debit_nor_credit"
    | "zero_amount"
    | "field_too_long"
    | "control_characters"
    | "currency_mismatch";
  message: string;
  field?: string;
};

/** One raw, tokenized line from the file — nothing here has been interpreted yet. */
export type RawParsedRow = {
  rowIndex: number;
  cells: string[];
};

/** The result of tokenizing + security-screening the uploaded bytes, before any column mapping is applied. */
export type StatementTokenizeResult =
  | {
      success: true;
      format: StatementFileFormat;
      delimiter: "," | ";" | "\t";
      encoding: "utf-8";
      header: string[];
      headerFingerprint: string;
      rows: RawParsedRow[];
      fileHash: string;
      fileSizeBytes: number;
    }
  | { success: false; error: string };

/** A column-mapping configuration, either freshly auto-detected or restored from a saved preset. */
export type StatementColumnMapping = {
  dateColumn: string;
  valueDateColumn?: string;
  descriptionColumn: string;
  referenceColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  amountColumn?: string;
  transactionTypeColumn?: string;
  balanceColumn?: string;
  dateFormat: StatementDateFormat;
  amountSignConvention: AmountSignConvention;
};

/** One header's auto-detected suggestion — surfaced to the user as a pre-filled, still-editable mapping form, never applied silently. */
export type ColumnDetectionField =
  | "dateColumn"
  | "valueDateColumn"
  | "descriptionColumn"
  | "referenceColumn"
  | "debitColumn"
  | "creditColumn"
  | "amountColumn"
  | "transactionTypeColumn"
  | "balanceColumn";

export type ColumnDetectionResult = {
  suggested: Partial<StatementColumnMapping>;
  confidence: MatchConfidence;
  /** Human-readable reasons behind each suggested field, keyed by field — shown next to the mapping form, not hidden. */
  reasons: Partial<Record<ColumnDetectionField, string>>;
};

/** A fully normalized staging row, ready for insert_statement_import_rows. */
export type NormalizedStatementRow = {
  rowIndex: number;
  rowHash: string;
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
  validationErrors: RowValidationError[];
};

/** A pure, explainable match candidate produced by matching.ts — never applied until the user confirms it. */
export type MatchCandidate =
  | {
      matchKind: "existing_transaction";
      rowId: string;
      candidateTransactionId: string;
      score: number;
      confidence: MatchConfidence;
      reasons: string[];
      conflicts: string[];
    }
  | {
      matchKind: "transfer_row";
      rowId: string;
      candidateRowId: string;
      score: number;
      confidence: MatchConfidence;
      reasons: string[];
      conflicts: string[];
    };

/** The three duplicate-classification inputs matching.ts needs — kept separate from DB row shape so the pure functions stay independently testable. */
export type DuplicateCheckInput = {
  rowHash: string;
  accountId: string;
  transactionDate: string | null;
  amount: Money | null;
  description: string;
};

export type ExistingLedgerRowForMatching = {
  transactionId: string;
  accountId: string;
  occurredOn: string;
  amount: Money;
  direction: RowDirection;
  description: string;
  sourceReference: string | null;
};

export type ReconciliationSummary = {
  status: ReconciliationStatus;
  openingBalance: Money | null;
  closingBalance: Money | null;
  parsedNetMovement: Money;
  expectedClosingBalance: Money | null;
  difference: Money | null;
  importedAmount: Money;
  matchedAmount: Money;
  excludedAmount: Money;
  invalidRowCount: number;
};
