import type { Tables } from "@/types/database.types";

/** A row of `public.categories` (see supabase/migrations), from the generated Database type. */
export type CategoryRow = Tables<"categories">;

export const CATEGORY_TYPES = ["income", "expense"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];
