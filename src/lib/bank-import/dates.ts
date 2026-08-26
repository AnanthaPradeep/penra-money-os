import { utcIsoToIstCalendarDate } from "@/lib/dates/timezone";
import type { StatementDateFormat } from "@/lib/bank-import/types";

/**
 * Every bank statement date is parsed against exactly one of these five
 * explicit formats — the format itself is always chosen and confirmed by
 * the user on the mapping screen (see apply_statement_import_mapping),
 * never auto-guessed per-cell. That is what keeps this genuinely
 * unambiguous: "12/05/2026" under an explicitly-selected DD/MM/YYYY format
 * has exactly one legal reading, even though the same string alone would
 * be ambiguous between day-first and month-first conventions.
 */

export type DateParseResult =
  | { success: true; isoDate: string; isFuture: boolean }
  | { success: false; reason: "invalid_date" };

const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * A two-digit year on a bank statement is always recent — no Indian bank
 * or credit-card statement predates 1980 in this application's scope — so
 * 00-79 maps to 2000-2079 and 80-99 maps to 1980-1999. This is a
 * documented, deterministic choice, not a guess: the same two-digit input
 * always resolves to the same four-digit year.
 */
function expandTwoDigitYear(twoDigitYear: number): number {
  return twoDigitYear <= 79 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function toIsoDate(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Positional (not named) capture groups — this project's TS target
// (ES2017) doesn't allow named-group regex literals at compile time even
// though the runtime supports them, so each pattern below documents its
// own [group1, group2, group3] -> field order instead.
type NumericFormatSpec = {
  pattern: RegExp;
  order: readonly [
    "day" | "month" | "year",
    "day" | "month" | "year",
    "day" | "month" | "year",
  ];
  yearGroupIsTwoDigit: boolean;
};

const NUMERIC_FORMAT_SPECS: Record<
  Exclude<StatementDateFormat, "DD MMM YYYY">,
  NumericFormatSpec
> = {
  "DD/MM/YYYY": {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    order: ["day", "month", "year"],
    yearGroupIsTwoDigit: false,
  },
  "DD-MM-YYYY": {
    pattern: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    order: ["day", "month", "year"],
    yearGroupIsTwoDigit: false,
  },
  "DD/MM/YY": {
    pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    order: ["day", "month", "year"],
    yearGroupIsTwoDigit: true,
  },
  "YYYY-MM-DD": {
    pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    order: ["year", "month", "day"],
    yearGroupIsTwoDigit: false,
  },
};

const DD_MMM_YYYY_PATTERN = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/;

function parseNumericParts(
  raw: string,
  spec: NumericFormatSpec,
): { day: number; month: number; year: number } | null {
  const match = spec.pattern.exec(raw);
  if (!match) {
    return null;
  }
  const values: Partial<Record<"day" | "month" | "year", number>> = {};
  for (let i = 0; i < spec.order.length; i += 1) {
    const field = spec.order[i];
    const raw_ = match[i + 1] ?? "";
    const parsedValue = Number.parseInt(raw_, 10);
    if (!Number.isFinite(parsedValue) || field === undefined) {
      return null;
    }
    values[field] =
      field === "year" && spec.yearGroupIsTwoDigit
        ? expandTwoDigitYear(parsedValue)
        : parsedValue;
  }
  if (
    values.day === undefined ||
    values.month === undefined ||
    values.year === undefined
  ) {
    return null;
  }
  return { day: values.day, month: values.month, year: values.year };
}

/** Parses one raw cell against an explicitly-chosen format; `today` is an IST "YYYY-MM-DD" calendar date, injected for pure testability. */
export function parseStatementDate(
  raw: string,
  format: StatementDateFormat,
  today: string,
): DateParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { success: false, reason: "invalid_date" };
  }

  let parts: { day: number; month: number; year: number } | null;

  if (format === "DD MMM YYYY") {
    const match = DD_MMM_YYYY_PATTERN.exec(trimmed);
    if (!match) {
      return { success: false, reason: "invalid_date" };
    }
    const [, dayRaw, monRaw, yearRaw] = match;
    const month = MONTH_ABBREVIATIONS[(monRaw ?? "").toLowerCase()];
    if (!month) {
      return { success: false, reason: "invalid_date" };
    }
    parts = {
      day: Number.parseInt(dayRaw ?? "", 10),
      month,
      year: Number.parseInt(yearRaw ?? "", 10),
    };
  } else {
    parts = parseNumericParts(trimmed, NUMERIC_FORMAT_SPECS[format]);
  }

  if (!parts) {
    return { success: false, reason: "invalid_date" };
  }

  const { day, month, year } = parts;
  if (!isValidCalendarDate(year, month, day)) {
    return { success: false, reason: "invalid_date" };
  }

  const isoDate = toIsoDate(year, month, day);
  return { success: true, isoDate, isFuture: isoDate > today };
}

/** Convenience wrapper for tests/callers that want "today" resolved from the real clock in Asia/Kolkata rather than injected. */
export function parseStatementDateNow(
  raw: string,
  format: StatementDateFormat,
): DateParseResult {
  return parseStatementDate(
    raw,
    format,
    utcIsoToIstCalendarDate(new Date().toISOString()),
  );
}
