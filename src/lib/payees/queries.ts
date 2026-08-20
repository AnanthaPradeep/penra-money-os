import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { mapPayeeRow, type Payee } from "@/lib/payees/mapping";
import type { Database } from "@/types/database.types";

/** Lists the caller's own active payees, alphabetically — small enough per user to load in full for a search-as-you-type combobox. */
export async function listPayees(
  supabase: SupabaseClient<Database>,
): Promise<Payee[]> {
  const { data, error } = await supabase
    .from("payees")
    .select("*")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapPayeeRow);
}
