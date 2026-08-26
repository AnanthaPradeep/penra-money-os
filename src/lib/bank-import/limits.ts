/**
 * Every bound in this file is enforced twice: once here in TypeScript
 * (fast, user-facing rejection before any row reaches the database) and
 * again as a database CHECK constraint or explicit RPC guard (see
 * supabase/migrations/20260825154818_phase11_bank_statement_import_v2.sql)
 * — the database is the boundary an attacker cannot bypass by calling the
 * RPC directly, TypeScript is what gives the user a fast, honest error
 * instead of a raw Postgres failure.
 */

/** Server Action body cap is 8MB (next.config.ts); stay comfortably under it. */
export const MAX_STATEMENT_FILE_BYTES = 6 * 1024 * 1024;

/** Matches statement_imports_row_count_bounds / insert_statement_import_rows in the migration. */
export const MAX_STATEMENT_IMPORT_ROWS = 2000;

/** A statement with more raw lines than this is rejected before parsing even begins — the decompression-bomb guard. */
export const MAX_STATEMENT_RAW_LINES = 20_000;

/** Columns beyond this width are almost certainly a malformed/adversarial file, not a real bank statement. */
export const MAX_STATEMENT_COLUMNS = 40;

/** A single cell longer than this cannot be a genuine date/description/amount/reference value. */
export const MAX_STATEMENT_FIELD_LENGTH = 2000;

/** Matches statement_import_rows_description_length. */
export const MAX_ROW_DESCRIPTION_LENGTH = 500;

/** Matches statement_import_rows_reference_length. */
export const MAX_ROW_REFERENCE_LENGTH = 200;

/** Bulk row-selection actions in the review table are capped for the same reason as MAX_STATEMENT_IMPORT_ROWS. */
export const MAX_BULK_SELECTION_ROWS = MAX_STATEMENT_IMPORT_ROWS;

/** Allowed MIME types for an uploaded statement — checked alongside (never instead of) the extension and sniffed content. */
export const ALLOWED_STATEMENT_MIME_TYPES = [
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
  "application/vnd.ms-excel",
  "application/csv",
  "",
] as const;

/** Allowed file extensions — the file must satisfy this AND look like the matching format once sniffed (see parser.ts). */
export const ALLOWED_STATEMENT_EXTENSIONS = [".csv", ".tsv", ".txt"] as const;

/** A day-window used when scoring existing-transaction / transfer candidates — never an unbounded scan across the whole ledger. */
export const MATCH_DATE_WINDOW_DAYS = 3;

/** Reconciliation is "balanced" only within this tolerance of true-zero, guarding against a stray fractional-paisa rounding artifact rather than hiding a real difference. */
export const RECONCILIATION_TOLERANCE = "0.01";
