/**
 * All ledger timestamps are stored as `timestamptz` (UTC) and displayed to
 * this personal, India-focused user in Asia/Kolkata. India does not
 * observe daylight saving time, so the offset is a fixed +05:30 —
 * conversion never needs a DST table, but it must still be done
 * explicitly (never by relying on the server process's local timezone,
 * which may not be IST).
 */

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts an Asia/Kolkata calendar date ("YYYY-MM-DD", meaning local
 * midnight on that day in India) into a UTC ISO timestamp string suitable
 * for a `timestamptz` column.
 */
export function istCalendarDateToUtcIso(calendarDate: string): string {
  if (!ISO_CALENDAR_DATE_PATTERN.test(calendarDate)) {
    throw new Error(`Invalid calendar date: ${calendarDate}`);
  }

  const utcMs = Date.parse(`${calendarDate}T00:00:00+05:30`);
  if (Number.isNaN(utcMs)) {
    throw new Error(`Invalid calendar date: ${calendarDate}`);
  }

  const utcIso = new Date(utcMs).toISOString();

  // Date.parse silently rolls an out-of-range date like "2026-02-30" over
  // into a valid later date (e.g. March) instead of failing — round-trip
  // through our own conversion to catch that instead of accepting it.
  if (utcIsoToIstCalendarDate(utcIso) !== calendarDate) {
    throw new Error(`Invalid calendar date: ${calendarDate}`);
  }

  return utcIso;
}

/** Converts a UTC timestamp into the Asia/Kolkata calendar date ("YYYY-MM-DD") it falls on. */
export function utcIsoToIstCalendarDate(utcIso: string): string {
  return IST_DATE_FORMATTER.format(new Date(utcIso));
}

/** Today's date as seen in Asia/Kolkata right now, not the server process's local timezone. */
export function nowAsIstCalendarDate(): string {
  return utcIsoToIstCalendarDate(new Date().toISOString());
}

/** Formats a UTC timestamp for display in Asia/Kolkata, e.g. "16 Aug 2026, 3:45 pm". */
export function formatIstDateTime(utcIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(utcIso));
}
