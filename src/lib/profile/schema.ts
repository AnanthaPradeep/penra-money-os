import { z } from "zod";

/**
 * Defaults for this personal, India-focused version of PENRA Money OS.
 * Mirrors the column defaults in the `profiles` migration
 * (supabase/migrations) — kept in sync manually since this is
 * application-level validation, deliberately separate from generated
 * database types (none exist yet — see src/lib/profile/types.ts).
 */
export const PROFILE_DEFAULTS = {
  baseCurrency: "INR",
  locale: "en-IN",
  timezone: "Asia/Kolkata",
  financialYearStartMonth: 4,
} as const;

/**
 * Kept intentionally small and INR-only for the current personal version,
 * but shaped as an enum (not a hardcoded literal) so a future multi-user
 * phase can extend the allowed list without changing the field's shape.
 */
export const baseCurrencySchema = z
  .enum(["INR"], { error: "Only INR is supported in this version." })
  .default(PROFILE_DEFAULTS.baseCurrency);

export const localeSchema = z
  .string()
  .trim()
  .min(1, "Locale cannot be blank.")
  .default(PROFILE_DEFAULTS.locale);

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone cannot be blank.")
  .default(PROFILE_DEFAULTS.timezone);

export const financialYearStartMonthSchema = z
  .number()
  .int("Financial-year start month must be a whole number.")
  .min(1, "Financial-year start month must be between 1 and 12.")
  .max(12, "Financial-year start month must be between 1 and 12.")
  .default(PROFILE_DEFAULTS.financialYearStartMonth);

export const profileDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter your name.")
  .max(80, "Name must be 80 characters or fewer.");

export const profileSchema = z.object({
  displayName: profileDisplayNameSchema,
  baseCurrency: baseCurrencySchema,
  locale: localeSchema,
  timezone: timezoneSchema,
  financialYearStartMonth: financialYearStartMonthSchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;
