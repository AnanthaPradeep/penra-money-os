/**
 * A small, dependency-free CSV writer shared by every Phase 13 export.
 * Two defensive rules apply to every cell, unconditionally:
 *
 *   1. Formula-injection neutralization (CSV/"Excel formula injection",
 *      OWASP-documented): a cell whose first character is one Excel/
 *      Sheets would interpret as starting a formula (`=`, `+`, `-`, `@`,
 *      tab, or carriage return) is prefixed with a single leading `'`.
 *      Spreadsheet applications treat a leading apostrophe as "force
 *      text" and do not display it, so this is invisible to the user but
 *      makes the cell inert as a formula.
 *   2. RFC 4180 quoting: a cell containing a comma, double quote, or
 *      newline is wrapped in double quotes with internal quotes doubled.
 *
 * This module never decides *what* goes in a report — see the
 * `build*Csv` functions in this same directory for the specific report
 * shapes; this file only ever turns already-built rows into safe text.
 */

const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;

/** Neutralizes formula-injection risk and applies RFC 4180 quoting to one cell value. */
export function csvCell(value: string): string {
  let cell = value;
  if (FORMULA_TRIGGER_PATTERN.test(cell)) {
    cell = `'${cell}`;
  }
  if (/[",\n\r]/.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string;
};

/** Renders `rows` as a full CSV document (header row + one row per item), CRLF line endings per RFC 4180. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => csvCell(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
