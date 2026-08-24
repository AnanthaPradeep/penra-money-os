import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapCompanyFilingRow,
  mapCompanyFinancialMetricRow,
  mapCompanyFinancialPeriodRow,
  mapCompanyProfileRow,
  mapInvestmentIdeaRow,
  mapInvestmentThesisRow,
  mapInvestmentThesisVersionRow,
  mapResearchNoteRow,
  mapResearchReminderRow,
  mapResearchReviewEventRow,
  mapWatchlistItemRow,
  mapWatchlistRow,
  type CompanyFiling,
  type CompanyFinancialMetric,
  type CompanyFinancialPeriod,
  type CompanyProfile,
  type InvestmentIdea,
  type InvestmentThesis,
  type InvestmentThesisVersion,
  type ResearchNote,
  type ResearchReminder,
  type ResearchReviewEvent,
  type Watchlist,
  type WatchlistItem,
} from "@/lib/research/mapping";
import type { Database } from "@/types/database.types";

export async function getCompanyProfile(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
): Promise<CompanyProfile | null> {
  const { data, error } = await supabase
    .from("company_profiles")
    .select("*")
    .eq("instrument_id", instrumentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapCompanyProfileRow(data);
}

export async function listCompanyFinancialPeriods(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
): Promise<CompanyFinancialPeriod[]> {
  const { data, error } = await supabase
    .from("company_financial_periods")
    .select("*")
    .eq("instrument_id", instrumentId)
    .eq("is_current", true)
    .order("fiscal_period_end", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapCompanyFinancialPeriodRow);
}

export async function listCompanyFinancialMetricsForPeriods(
  supabase: SupabaseClient<Database>,
  periodIds: readonly string[],
): Promise<CompanyFinancialMetric[]> {
  if (periodIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("company_financial_metrics")
    .select("*")
    .in("period_id", periodIds)
    .eq("is_current", true);

  if (error || !data) {
    return [];
  }
  return data.map(mapCompanyFinancialMetricRow);
}

export async function listWatchlists(
  supabase: SupabaseClient<Database>,
): Promise<Watchlist[]> {
  const { data, error } = await supabase
    .from("watchlists")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapWatchlistRow);
}

export async function getWatchlistById(
  supabase: SupabaseClient<Database>,
  watchlistId: string,
): Promise<Watchlist | null> {
  const { data, error } = await supabase
    .from("watchlists")
    .select("*")
    .eq("id", watchlistId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapWatchlistRow(data);
}

export async function listWatchlistItems(
  supabase: SupabaseClient<Database>,
  watchlistId: string,
): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("watchlist_id", watchlistId)
    .order("sort_order", { ascending: true })
    .order("added_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapWatchlistItemRow);
}

export async function listAllWatchlistItems(
  supabase: SupabaseClient<Database>,
): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .order("added_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapWatchlistItemRow);
}

export async function listResearchNotesForInstrument(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
): Promise<ResearchNote[]> {
  const { data, error } = await supabase
    .from("research_notes")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapResearchNoteRow);
}

export async function listCompanyFilingsForInstrument(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
): Promise<CompanyFiling[]> {
  const { data, error } = await supabase
    .from("company_filings")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("filing_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapCompanyFilingRow);
}

/** The caller's single current (non-closed/archived) thesis for one company, if any — matches the DB's own uniqueness rule. */
export async function getCurrentThesisForInstrument(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
): Promise<InvestmentThesis | null> {
  const { data, error } = await supabase
    .from("investment_theses")
    .select("*")
    .eq("instrument_id", instrumentId)
    .not("status", "in", "(closed,archived)")
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapInvestmentThesisRow(data);
}

export async function listThesesForInstrument(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
): Promise<InvestmentThesis[]> {
  const { data, error } = await supabase
    .from("investment_theses")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapInvestmentThesisRow);
}

export async function getThesisById(
  supabase: SupabaseClient<Database>,
  thesisId: string,
): Promise<InvestmentThesis | null> {
  const { data, error } = await supabase
    .from("investment_theses")
    .select("*")
    .eq("id", thesisId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapInvestmentThesisRow(data);
}

export async function listThesisVersions(
  supabase: SupabaseClient<Database>,
  thesisId: string,
): Promise<InvestmentThesisVersion[]> {
  const { data, error } = await supabase
    .from("investment_thesis_versions")
    .select("*")
    .eq("thesis_id", thesisId)
    .order("version", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapInvestmentThesisVersionRow);
}

export async function listAllTheses(
  supabase: SupabaseClient<Database>,
): Promise<InvestmentThesis[]> {
  const { data, error } = await supabase
    .from("investment_theses")
    .select("*")
    .order("expected_review_date", { ascending: true, nullsFirst: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapInvestmentThesisRow);
}

export async function listInvestmentIdeas(
  supabase: SupabaseClient<Database>,
): Promise<InvestmentIdea[]> {
  const { data, error } = await supabase
    .from("investment_ideas")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapInvestmentIdeaRow);
}

export async function getInvestmentIdeaById(
  supabase: SupabaseClient<Database>,
  ideaId: string,
): Promise<InvestmentIdea | null> {
  const { data, error } = await supabase
    .from("investment_ideas")
    .select("*")
    .eq("id", ideaId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapInvestmentIdeaRow(data);
}

export async function listReviewEventsForIdea(
  supabase: SupabaseClient<Database>,
  ideaId: string,
): Promise<ResearchReviewEvent[]> {
  const { data, error } = await supabase
    .from("research_review_events")
    .select("*")
    .eq("related_table", "investment_ideas")
    .eq("related_id", ideaId)
    .order("occurred_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapResearchReviewEventRow);
}

export async function listRecentReviewEvents(
  supabase: SupabaseClient<Database>,
  limit = 10,
): Promise<ResearchReviewEvent[]> {
  const { data, error } = await supabase
    .from("research_review_events")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }
  return data.map(mapResearchReviewEventRow);
}

export async function getResearchReviewReminders(
  supabase: SupabaseClient<Database>,
): Promise<ResearchReminder[]> {
  const { data, error } = await supabase.rpc("research_review_reminders");

  if (error || !data) {
    return [];
  }
  return data.map(mapResearchReminderRow);
}
