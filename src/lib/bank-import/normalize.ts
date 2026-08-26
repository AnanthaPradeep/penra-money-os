import { createHash } from "node:crypto";

import { parseStatementDate } from "@/lib/bank-import/dates";
import {
  MAX_ROW_DESCRIPTION_LENGTH,
  MAX_ROW_REFERENCE_LENGTH,
} from "@/lib/bank-import/limits";
import {
  parseStatementAmountCell,
  resolveDebitCreditColumns,
  resolveSignedAmountColumn,
} from "@/lib/bank-import/money";
import type {
  AmountColumnShape,
  NormalizedStatementRow,
  RawParsedRow,
  RowValidationError,
  StatementColumnMapping,
} from "@/lib/bank-import/types";

/**
 * Version marker for this normalization pipeline. A future change to any
 * rule below (date/amount parsing, description sanitization, hashing) must
 * bump this — it exists so a stored row can, in principle, be traced back
 * to the exact rule set that produced it, even though nothing currently
 * persists it as a column.
 */
export const NORMALIZATION_PIPELINE_VERSION = 1;

const FORMULA_LEADING_CHARACTERS = new Set(["=", "+", "-", "@"]);

/**
 * A cell that opens with a character a spreadsheet program treats as a
 * formula prefix is stored with a leading apostrophe — the same
 * "force text" convention Excel/Sheets/LibreOffice themselves use — so the
 * value can never be reinterpreted as a formula if it is ever opened in
 * one, without altering what it actually says.
 */
function neutralizeFormulaLeadingText(raw: string): string {
  const trimmed = raw.trim();
  const first = trimmed[0];
  if (first !== undefined && FORMULA_LEADING_CHARACTERS.has(first)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * The matching key derived from a description — lowercased, whitespace-
 * collapsed — used only transiently by matching.ts / rule evaluation.
 * Never stored: the original description (see NormalizedStatementRow) is
 * always the value displayed and posted, so a future change to this
 * function can never retroactively alter what a past row says.
 */
export function computeDescriptionMatchKey(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellFor(
  header: string[],
  cells: string[],
  columnName: string | undefined,
): string {
  if (!columnName) {
    return "";
  }
  const index = header.indexOf(columnName);
  if (index === -1) {
    return "";
  }
  return cells[index] ?? "";
}

function computeRowHash(cells: string[]): string {
  return createHash("sha256").update(JSON.stringify(cells)).digest("hex");
}

export type NormalizeRowParams = {
  rawRow: RawParsedRow;
  header: string[];
  mapping: StatementColumnMapping;
  amountShape: AmountColumnShape;
  todayIstDate: string;
  importCurrency: string;
};

/**
 * Turns one tokenized raw row into a NormalizedStatementRow, ready for
 * insert_statement_import_rows. Never throws and never drops a row:
 * anything that cannot be safely interpreted becomes a RowValidationError
 * attached to the row instead, so invalid/unsupported rows stay visible
 * for the user to review rather than silently vanishing.
 */
export function normalizeStatementRow(
  params: NormalizeRowParams,
): NormalizedStatementRow {
  const { rawRow, header, mapping, amountShape, todayIstDate, importCurrency } =
    params;
  const cells = rawRow.cells;
  const errors: RowValidationError[] = [];

  const dateRaw = cellFor(header, cells, mapping.dateColumn);
  let transactionDate: string | null = null;
  if (dateRaw.trim().length === 0) {
    errors.push({
      code: "missing_date",
      message: "This row has no transaction date.",
      field: "transactionDate",
    });
  } else {
    const dateResult = parseStatementDate(
      dateRaw,
      mapping.dateFormat,
      todayIstDate,
    );
    if (!dateResult.success) {
      errors.push({
        code: "invalid_date",
        message: `"${dateRaw.trim()}" doesn't match the selected date format.`,
        field: "transactionDate",
      });
    } else {
      transactionDate = dateResult.isoDate;
      if (dateResult.isFuture) {
        errors.push({
          code: "future_date",
          message: "This transaction date is in the future.",
          field: "transactionDate",
        });
      }
    }
  }

  const valueDateRaw = cellFor(header, cells, mapping.valueDateColumn);
  let valueDate: string | null = null;
  if (valueDateRaw.trim().length > 0) {
    const valueDateResult = parseStatementDate(
      valueDateRaw,
      mapping.dateFormat,
      todayIstDate,
    );
    if (valueDateResult.success) {
      valueDate = valueDateResult.isoDate;
    }
  }

  const descriptionRaw = cellFor(header, cells, mapping.descriptionColumn);
  const description = neutralizeFormulaLeadingText(descriptionRaw).slice(
    0,
    MAX_ROW_DESCRIPTION_LENGTH,
  );
  if (description.length === 0) {
    errors.push({
      code: "missing_description",
      message: "This row has no description.",
      field: "description",
    });
  }

  const referenceRaw = cellFor(header, cells, mapping.referenceColumn);
  const reference =
    referenceRaw.trim().length > 0
      ? neutralizeFormulaLeadingText(referenceRaw).slice(
          0,
          MAX_ROW_REFERENCE_LENGTH,
        )
      : null;

  // No statement_imports mapping column is allocated for a cheque number in
  // this phase's schema — statement_import_rows.cheque_number stays null;
  // a cheque reference a bank does export shows up via reference_column
  // instead, which every mapping already covers.
  const chequeNumber: string | null = null;

  let amount: NormalizedStatementRow["amount"] = null;
  let direction: NormalizedStatementRow["direction"] = null;

  const amountResolution =
    amountShape === "debit_credit_columns"
      ? resolveDebitCreditColumns(
          cellFor(header, cells, mapping.debitColumn),
          cellFor(header, cells, mapping.creditColumn),
        )
      : resolveSignedAmountColumn(
          cellFor(header, cells, mapping.amountColumn),
          mapping.amountSignConvention,
        );

  if (amountResolution.success) {
    amount = amountResolution.amount;
    direction = amountResolution.direction;
  } else {
    const messageByReason: Record<typeof amountResolution.reason, string> = {
      missing_amount: "This row has no amount.",
      invalid_amount: "This row's amount could not be read.",
      both_debit_and_credit:
        "This row has both a debit and a credit value — only one is allowed.",
      neither_debit_nor_credit: "This row has no debit or credit value.",
      zero_amount: "This row's amount is zero.",
    };
    errors.push({
      code: amountResolution.reason,
      message: messageByReason[amountResolution.reason],
      field: "amount",
    });
  }

  let runningBalance: NormalizedStatementRow["runningBalance"] = null;
  const balanceRaw = cellFor(header, cells, mapping.balanceColumn);
  if (balanceRaw.trim().length > 0) {
    const balanceCell = parseStatementAmountCell(balanceRaw);
    if (balanceCell.kind === "value") {
      runningBalance =
        balanceCell.explicitSign === "negative"
          ? balanceCell.magnitude.negated()
          : balanceCell.magnitude;
    }
  }

  return {
    rowIndex: rawRow.rowIndex,
    rowHash: computeRowHash(cells),
    transactionDate,
    valueDate,
    description,
    reference,
    chequeNumber,
    amount,
    direction,
    runningBalance,
    currency: importCurrency,
    suggestedTransactionType: null,
    validationErrors: errors,
  };
}
