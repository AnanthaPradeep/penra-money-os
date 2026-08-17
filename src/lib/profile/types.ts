/**
 * Hand-written application-level type describing the shape of a row in
 * `public.profiles` (see supabase/migrations). This is NOT a substitute
 * for, and must never be confused with, the Supabase CLI's generated
 * `Database` type (`supabase gen types typescript`) — that file does not
 * exist yet because type generation could not be run in this environment
 * (no local Docker stack, no linked remote project with credentials
 * capable of schema introspection). See the Phase 2 implementation notes
 * in the chat response for the exact blocker and the commands to run once
 * generation is possible (`pnpm db:types:local` / `pnpm db:types:linked`,
 * already defined in package.json since Phase 1).
 *
 * Kept intentionally separate from `src/lib/profile/schema.ts` (the Zod
 * validation for *input* to a profile update) — this type describes what a
 * row looks like when *read back* from the database.
 */
export type ProfileRow = {
  id: string;
  display_name: string | null;
  base_currency: string;
  locale: string;
  timezone: string;
  financial_year_start_month: number;
  created_at: string;
  updated_at: string;
};
