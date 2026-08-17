import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/profile/types";

/**
 * Reads the given user's own profile row. Relies on Row Level Security
 * (see supabase/migrations) as the authoritative access boundary — this
 * function does not itself enforce ownership beyond the `.eq()` filter,
 * which is defence in depth, not the only line of defence.
 */
export async function getProfileForUser(
  userId: string,
): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ProfileRow;
}
