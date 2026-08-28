import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

/**
 * An Indian financial year runs 1 April (inclusive) to 31 March
 * (inclusive) the following calendar year. Every function here works on
 * plain "YYYY-MM-DD" calendar-date strings — the same IST-calendar-date
 * representation `nowAsIstCalendarDate()`/`utcIsoToIstCalendarDate()`
 * already produce — so no new timezone conversion logic is introduced
 * here; a caller holding a UTC timestamptz must first convert it via
 * `utcIsoToIstCalendarDate()` before passing it to `financialYearForDate`.
 *
 * The canonical financial-year id is "YYYY-YY" (e.g. "2026-27" for the
 * year starting 1 April 2026), matching how Indian tax documents
 * conventionally write it — never "YYYY-YYYY" or a bare start year alone.
 */

const FY_ID_PATTERN = /^(\d{4})-(\d{2})$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type FinancialYear = {
  /** Canonical id, e.g. "2026-27". */
  id: string;
  /** Calendar year the financial year starts in. */
  startYear: number;
  /** "1 April 2026" start date, inclusive, "YYYY-MM-DD". */
  startDate: string;
  /** "31 March 2027" end date, inclusive, "YYYY-MM-DD". */
  endDate: string;
  /** "FY 2026-27". */
  label: string;
  /** Assessment year id, "2027-28". */
  assessmentYearId: string;
  /** "AY 2027-28". */
  assessmentYearLabel: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/** Builds the full FinancialYear descriptor for the financial year starting 1 April of `startYear`. */
export function financialYearFromStartYear(startYear: number): FinancialYear {
  if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2200) {
    throw new Error(`Invalid financial-year start year: ${startYear}`);
  }

  const endYear = startYear + 1;
  const id = `${pad4(startYear)}-${pad2(endYear % 100)}`;
  const assessmentStartYear = endYear;
  const assessmentEndYear = assessmentStartYear + 1;
  const assessmentYearId = `${pad4(assessmentStartYear)}-${pad2(assessmentEndYear % 100)}`;

  return {
    id,
    startYear,
    startDate: `${pad4(startYear)}-04-01`,
    endDate: `${pad4(endYear)}-03-31`,
    label: `FY ${id}`,
    assessmentYearId,
    assessmentYearLabel: `AY ${assessmentYearId}`,
  };
}

/** Parses a canonical "YYYY-YY" financial-year id, validating the two halves are consecutive years. Throws on malformed input rather than guessing. */
export function parseFinancialYearId(id: string): FinancialYear {
  const match = FY_ID_PATTERN.exec(id);
  if (!match) {
    throw new Error(`Invalid financial-year id: ${id}`);
  }
  const startYear = Number(match[1]);
  const endYearSuffix = Number(match[2]);
  const expectedSuffix = (startYear + 1) % 100;
  if (endYearSuffix !== expectedSuffix) {
    throw new Error(`Invalid financial-year id (non-consecutive years): ${id}`);
  }
  return financialYearFromStartYear(startYear);
}

/** True when `id` is a well-formed, internally-consistent financial-year id — safe to call before parseFinancialYearId to avoid a thrown exception in a validation path. */
export function isValidFinancialYearId(id: string): boolean {
  try {
    parseFinancialYearId(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps an IST calendar date ("YYYY-MM-DD") to the financial year it falls
 * in. 1 April through 31 December fall in the financial year starting
 * that same calendar year; 1 January through 31 March fall in the
 * financial year that started the previous calendar year. Boundary dates
 * (31 March, 1 April) are handled by this same date-only comparison —
 * there is no midnight/timezone ambiguity once the caller has already
 * reduced a timestamp to its IST calendar date.
 */
export function financialYearForDate(calendarDate: string): FinancialYear {
  if (!CALENDAR_DATE_PATTERN.test(calendarDate)) {
    throw new Error(`Invalid calendar date: ${calendarDate}`);
  }
  const year = Number(calendarDate.slice(0, 4));
  const month = Number(calendarDate.slice(5, 7));
  const startYear = month >= 4 ? year : year - 1;
  return financialYearFromStartYear(startYear);
}

/** The financial year "now" (IST) falls in. */
export function currentFinancialYear(): FinancialYear {
  return financialYearForDate(nowAsIstCalendarDate());
}

/** True when `calendarDate` falls within `financialYear`'s [startDate, endDate] range, inclusive on both ends. */
export function isDateInFinancialYear(
  calendarDate: string,
  financialYear: FinancialYear,
): boolean {
  return (
    calendarDate >= financialYear.startDate &&
    calendarDate <= financialYear.endDate
  );
}

/** The most recent `count` financial-year ids, newest first, ending at the current financial year — for a financial-year selector control. */
export function listRecentFinancialYearIds(count: number): string[] {
  const current = currentFinancialYear();
  return Array.from({ length: count }, (_, i) =>
    financialYearFromStartYear(current.startYear - i),
  ).map((fy) => fy.id);
}
