/**
 * Deterministic recurrence date math — the TypeScript half of the
 * "canonical" recurrence algorithm. The database independently implements
 * the exact same semantics in SQL (public.recurring_occurrence_date, see
 * supabase/migrations) since actual occurrence generation must happen
 * atomically in the database; this module exists for anything the UI/
 * Server Action layer needs client-side (e.g. a "next few dates" preview
 * before submitting a new recurring item) so that logic is never
 * duplicated between forms and Server Actions. Unit tests here and pgTAP
 * tests against the SQL function assert the same edge cases (31st, Feb 29,
 * quarterly/half-yearly anchoring) to keep the two definitions provably in
 * sync rather than merely both "probably correct."
 *
 * Every date is a plain "YYYY-MM-DD" calendar-date string, manipulated as
 * integer year/month/day components — never a JS `Date` object — so there
 * is no timezone/DST ambiguity to reason about at all (see
 * src/lib/dates/timezone.ts for why the rest of the app is careful about
 * exactly this).
 */

export const RECURRENCE_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

const MONTHS_PER_STEP: Record<
  Exclude<RecurrenceFrequency, "weekly">,
  number
> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

type CalendarDateParts = { year: number; month: number; day: number };

function parseCalendarDate(isoDate: string): CalendarDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const yearText = match?.[1];
  const monthText = match?.[2];
  const dayText = match?.[3];
  if (!yearText || !monthText || !dayText) {
    throw new Error(`Invalid calendar date: ${isoDate}`);
  }
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  };
}

function formatCalendarDate(parts: CalendarDateParts): string {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAYS_IN_MONTH_NON_LEAP = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
] as const;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return DAYS_IN_MONTH_NON_LEAP[month - 1] ?? 31;
}

/** Adds a whole number of days to a calendar-date string, via epoch-day arithmetic (never a JS `Date` object's local-timezone-sensitive add). */
function addDays(isoDate: string, days: number): string {
  const parts = parseCalendarDate(isoDate);
  const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day);
  const resultMs = utcMs + days * 24 * 60 * 60 * 1000;
  const result = new Date(resultMs);
  return formatCalendarDate({
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  });
}

/**
 * Adds a whole number of months to a calendar-date string, clamping the
 * day-of-month to the last valid day of the resulting month (31st ->
 * last day of a shorter month; Feb 29 anchor -> Feb 28 in a non-leap
 * year) — matching public.recurring_occurrence_date's plpgsql
 * implementation exactly, rather than relying on any JS Date arithmetic
 * that would otherwise silently roll over (e.g. "Jan 31 + 1 month" via
 * `Date` becomes "Mar 3", not "Feb 28").
 */
function addMonthsClamped(isoDate: string, months: number): string {
  const anchor = parseCalendarDate(isoDate);
  const totalMonths = anchor.month - 1 + months;
  const year = anchor.year + Math.floor(totalMonths / 12);
  const month = (((totalMonths % 12) + 12) % 12) + 1;
  const lastDay = daysInMonth(year, month);
  return formatCalendarDate({
    year,
    month,
    day: Math.min(anchor.day, lastDay),
  });
}

/**
 * The k-th (0-indexed) occurrence date for a recurrence anchored at
 * `anchorIsoDate`. Mirrors public.recurring_occurrence_date exactly:
 * weekly steps by whole weeks; monthly/quarterly/half_yearly/yearly step
 * by months with day-of-month clamping applied fresh from the anchor on
 * every step (so multi-step math never compounds drift).
 */
export function computeOccurrenceDate(
  anchorIsoDate: string,
  frequency: RecurrenceFrequency,
  intervalCount: number,
  k: number,
): string {
  if (frequency === "weekly") {
    return addDays(anchorIsoDate, k * intervalCount * 7);
  }

  const monthsPerStep = MONTHS_PER_STEP[frequency];
  return addMonthsClamped(anchorIsoDate, monthsPerStep * intervalCount * k);
}

/**
 * Computes the next `count` occurrence dates on/after `afterIsoDate`
 * (inclusive) — used only for a client-side "next few dates" preview in
 * the recurring-item form; actual occurrence generation is always
 * authoritative in the database (see generate_occurrences_for_item).
 * Bounded by a hard iteration cap so a pathological input can never loop
 * unboundedly.
 */
export function nextOccurrenceDates(
  anchorIsoDate: string,
  frequency: RecurrenceFrequency,
  intervalCount: number,
  afterIsoDate: string,
  count: number,
): string[] {
  const dates: string[] = [];
  for (let k = 0; k < 2000 && dates.length < count; k += 1) {
    const date = computeOccurrenceDate(
      anchorIsoDate,
      frequency,
      intervalCount,
      k,
    );
    if (date >= afterIsoDate) {
      dates.push(date);
    }
  }
  return dates;
}
