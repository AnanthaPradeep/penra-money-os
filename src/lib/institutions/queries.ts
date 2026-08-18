import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapInstitutionRow,
  type Institution,
} from "@/lib/institutions/mapping";
import type { Database } from "@/types/database.types";

/** Lists the caller's own institutions, relying on Row Level Security for ownership scoping. */
export async function listInstitutions(
  supabase: SupabaseClient<Database>,
): Promise<Institution[]> {
  const { data, error } = await supabase
    .from("institutions")
    .select("*")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapInstitutionRow);
}

export async function getInstitutionById(
  supabase: SupabaseClient<Database>,
  institutionId: string,
): Promise<Institution | null> {
  const { data, error } = await supabase
    .from("institutions")
    .select("*")
    .eq("id", institutionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapInstitutionRow(data);
}
