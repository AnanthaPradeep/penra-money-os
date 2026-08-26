/** Shared action-state shape for every bank-import Server Action — see src/lib/ledger/action-state.ts for the established pattern this mirrors. */
export type BankImportActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_BANK_IMPORT_ACTION_STATE: BankImportActionState = {
  status: "idle",
};

/**
 * uploadStatementAction's result carries the tokenized file back to the
 * client (never persisted server-side — see parser.ts's module comment)
 * so the mapping step can round-trip it back on confirmation without the
 * user re-selecting the file or the server storing raw statement bytes
 * anywhere.
 */
export type UploadStatementActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | {
      status: "success";
      importId: string;
      isDuplicateFile: boolean;
      existingImportId: string | null;
      currency: string;
      header: string[];
      rows: { rowIndex: number; cells: string[] }[];
      suggestedMapping: Partial<{
        dateColumn: string;
        valueDateColumn: string;
        descriptionColumn: string;
        referenceColumn: string;
        debitColumn: string;
        creditColumn: string;
        amountColumn: string;
        transactionTypeColumn: string;
        balanceColumn: string;
      }>;
      detectionConfidence: "high" | "medium" | "low";
      detectionReasons: Partial<Record<string, string>>;
    };

export const INITIAL_UPLOAD_STATEMENT_ACTION_STATE: UploadStatementActionState =
  { status: "idle" };
