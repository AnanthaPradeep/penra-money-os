import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { mapCategoryRow, type Category } from "@/lib/categories/mapping";
import type { CategoryType } from "@/lib/categories/types";
import type { Database } from "@/types/database.types";

/**
 * Lists the caller's own active categories, optionally filtered by type,
 * ordered for display (system defaults by their curated sort_order, then
 * custom categories alphabetically after them).
 */
export async function listCategories(
  supabase: SupabaseClient<Database>,
  type?: CategoryType,
): Promise<Category[]> {
  let query = supabase
    .from("categories")
    .select("*")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (type) {
    query = query.eq("category_type", type);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(mapCategoryRow);
}

export async function getCategoryById(
  supabase: SupabaseClient<Database>,
  categoryId: string,
): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapCategoryRow(data);
}
