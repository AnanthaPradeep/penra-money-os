import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapIpoDocumentRow,
  mapIpoFinancialMetricRow,
  mapIpoIssueRow,
  mapIpoResearchNoteRow,
  mapIpoStatusHistoryRow,
  mapIpoWatchlistItemRow,
  type IpoDocument,
  type IpoFinancialMetric,
  type IpoIssue,
  type IpoResearchNote,
  type IpoStatusHistoryEntry,
  type IpoWatchlistItem,
} from "@/lib/ipo/mapping";
import type { Database } from "@/types/database.types";

export async function listIpoIssues(
  supabase: SupabaseClient<Database>,
): Promise<IpoIssue[]> {
  const { data, error } = await supabase
    .from("ipo_issues")
    .select("*")
    .order("issue_open_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapIpoIssueRow);
}

export async function getIpoIssueById(
  supabase: SupabaseClient<Database>,
  ipoIssueId: string,
): Promise<IpoIssue | null> {
  const { data, error } = await supabase
    .from("ipo_issues")
    .select("*")
    .eq("id", ipoIssueId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapIpoIssueRow(data);
}

export async function listIpoStatusHistory(
  supabase: SupabaseClient<Database>,
  ipoIssueId: string,
): Promise<IpoStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from("ipo_status_history")
    .select("*")
    .eq("ipo_issue_id", ipoIssueId)
    .order("changed_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapIpoStatusHistoryRow);
}

export async function listIpoDocuments(
  supabase: SupabaseClient<Database>,
  ipoIssueId: string,
): Promise<IpoDocument[]> {
  const { data, error } = await supabase
    .from("ipo_documents")
    .select("*")
    .eq("ipo_issue_id", ipoIssueId)
    .order("filing_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapIpoDocumentRow);
}

export async function listIpoFinancialMetrics(
  supabase: SupabaseClient<Database>,
  ipoIssueId: string,
): Promise<IpoFinancialMetric[]> {
  const { data, error } = await supabase
    .from("ipo_financial_metrics")
    .select("*")
    .eq("ipo_issue_id", ipoIssueId)
    .eq("is_current", true)
    .order("fiscal_period_end", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapIpoFinancialMetricRow);
}

export async function listIpoWatchlistItems(
  supabase: SupabaseClient<Database>,
): Promise<IpoWatchlistItem[]> {
  const { data, error } = await supabase
    .from("ipo_watchlist_items")
    .select("*")
    .order("added_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapIpoWatchlistItemRow);
}

export async function getIpoWatchlistItem(
  supabase: SupabaseClient<Database>,
  ipoIssueId: string,
): Promise<IpoWatchlistItem | null> {
  const { data, error } = await supabase
    .from("ipo_watchlist_items")
    .select("*")
    .eq("ipo_issue_id", ipoIssueId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapIpoWatchlistItemRow(data);
}

export async function getIpoResearchNote(
  supabase: SupabaseClient<Database>,
  ipoIssueId: string,
): Promise<IpoResearchNote | null> {
  const { data, error } = await supabase
    .from("ipo_research_notes")
    .select("*")
    .eq("ipo_issue_id", ipoIssueId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapIpoResearchNoteRow(data);
}
