import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapCorporateEventRow,
  type CorporateEvent,
} from "@/lib/corporate-events/mapping";
import type { Database } from "@/types/database.types";

export async function listCorporateEventsForInstrument(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
): Promise<CorporateEvent[]> {
  const { data, error } = await supabase
    .from("corporate_events")
    .select("*")
    .eq("instrument_id", instrumentId)
    .eq("is_current", true)
    .order("received_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapCorporateEventRow);
}

export async function getCorporateEventById(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<CorporateEvent | null> {
  const { data, error } = await supabase
    .from("corporate_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapCorporateEventRow(data);
}

/**
 * Current events for a set of instruments (e.g. the caller's own held or
 * watched instruments), most recently received first. Callers apply any
 * further date-window/relevance filtering in TypeScript — mirrors how
 * other dashboard widgets in this app filter an already-fetched list
 * rather than pushing every condition into SQL.
 */
export async function listCorporateEventsForInstruments(
  supabase: SupabaseClient<Database>,
  instrumentIds: readonly string[],
  limit = 50,
): Promise<CorporateEvent[]> {
  if (instrumentIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("corporate_events")
    .select("*")
    .in("instrument_id", instrumentIds)
    .eq("is_current", true)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }
  return data.map(mapCorporateEventRow);
}

export async function listRecentCorporateEvents(
  supabase: SupabaseClient<Database>,
  limit = 20,
): Promise<CorporateEvent[]> {
  const { data, error } = await supabase
    .from("corporate_events")
    .select("*")
    .eq("is_current", true)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }
  return data.map(mapCorporateEventRow);
}
