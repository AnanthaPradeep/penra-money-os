import type { Tables } from "@/types/database.types";

/** A row of `public.accounts` (see supabase/migrations), from the generated Database type. */
export type AccountRow = Tables<"accounts">;
