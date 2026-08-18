import type { Tables } from "@/types/database.types";

/**
 * A row of `public.profiles` (see supabase/migrations), from the generated
 * Database type.
 *
 * Kept as a distinct alias (rather than importing `Tables<"profiles">`
 * directly at every call site) so the domain boundary between "what a
 * profile row looks like" and "what input the update form validates"
 * (`src/lib/profile/schema.ts`) stays easy to name and grep for.
 */
export type ProfileRow = Tables<"profiles">;
