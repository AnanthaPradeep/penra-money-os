import { z } from "zod";

import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a "YYYY-MM-DD" transaction date (as produced by an
 * `<input type="date">`) and rejects a future date by default — "future"
 * meaning after today in Asia/Kolkata, not the server process's local
 * timezone. Manual transactions always go through this schema; nothing
 * bypasses it by constructing a timestamp directly.
 */
export const transactionDateSchema = z
  .string()
  .trim()
  .refine((value) => ISO_CALENDAR_DATE_PATTERN.test(value), {
    error: "Enter a valid date.",
  })
  .refine((value) => value <= nowAsIstCalendarDate(), {
    error: "Date cannot be in the future.",
  });

/**
 * A plain "YYYY-MM-DD" calendar date with no future-date restriction —
 * unlike transactionDateSchema, a recurring item's start date, end date,
 * or a budget period month is routinely in the future by design.
 */
export const calendarDateSchema = z
  .string()
  .trim()
  .refine((value) => ISO_CALENDAR_DATE_PATTERN.test(value), {
    error: "Enter a valid date.",
  });
