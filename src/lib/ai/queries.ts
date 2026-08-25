import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapAiJobOutputRow,
  mapAiJobRow,
  mapAiJobSourceRow,
  mapAiProviderModelRow,
  mapAiUsageDailyRow,
  mapSourceDocumentChunkRow,
  type AiJob,
  type AiJobOutput,
  type AiJobSource,
  type AiProviderModel,
  type AiUsageDaily,
  type SourceDocumentChunk,
} from "@/lib/ai/mapping";
import type { Database } from "@/types/database.types";

/** Every seeded provider/model row, including disabled ones — the AI settings page shows the full catalogue honestly rather than hiding what exists but isn't configured. */
export async function listAiProviderModels(
  supabase: SupabaseClient<Database>,
): Promise<AiProviderModel[]> {
  const { data, error } = await supabase
    .from("ai_provider_models")
    .select("*")
    .order("provider", { ascending: true })
    .order("model_id", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapAiProviderModelRow);
}

export async function listAiJobs(
  supabase: SupabaseClient<Database>,
  limit = 50,
): Promise<AiJob[]> {
  const { data, error } = await supabase
    .from("ai_jobs")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }
  return data.map(mapAiJobRow);
}

export async function getAiJobById(
  supabase: SupabaseClient<Database>,
  jobId: string,
): Promise<AiJob | null> {
  const { data, error } = await supabase
    .from("ai_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapAiJobRow(data);
}

export async function listAiJobSources(
  supabase: SupabaseClient<Database>,
  jobId: string,
): Promise<AiJobSource[]> {
  const { data, error } = await supabase
    .from("ai_job_sources")
    .select("*")
    .eq("job_id", jobId);

  if (error || !data) {
    return [];
  }
  return data.map(mapAiJobSourceRow);
}

export async function listAiJobOutputs(
  supabase: SupabaseClient<Database>,
  jobId: string,
): Promise<AiJobOutput[]> {
  const { data, error } = await supabase
    .from("ai_job_outputs")
    .select("*")
    .eq("job_id", jobId)
    .order("display_order", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapAiJobOutputRow);
}

export async function getAiUsageToday(
  supabase: SupabaseClient<Database>,
): Promise<AiUsageDaily | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("ai_usage_daily")
    .select("*")
    .eq("usage_date", today)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapAiUsageDailyRow(data);
}

export async function listSourceDocumentChunksForIpoDocument(
  supabase: SupabaseClient<Database>,
  ipoDocumentId: string,
): Promise<SourceDocumentChunk[]> {
  const { data, error } = await supabase
    .from("source_document_chunks")
    .select("*")
    .eq("ipo_document_id", ipoDocumentId)
    .order("page_number", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapSourceDocumentChunkRow);
}

export async function listSourceDocumentChunksForCompanyFiling(
  supabase: SupabaseClient<Database>,
  companyFilingId: string,
): Promise<SourceDocumentChunk[]> {
  const { data, error } = await supabase
    .from("source_document_chunks")
    .select("*")
    .eq("company_filing_id", companyFilingId)
    .order("page_number", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapSourceDocumentChunkRow);
}

/** Every chunk the caller has ever transcribed, most recent first — RLS already scopes this to the caller's own rows, matching listAllWatchlistItems's no-explicit-filter pattern. Used by the research-assistant scope/source picker. */
export async function listAllSourceDocumentChunks(
  supabase: SupabaseClient<Database>,
): Promise<SourceDocumentChunk[]> {
  const { data, error } = await supabase
    .from("source_document_chunks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapSourceDocumentChunkRow);
}

export async function listSourceDocumentChunksByIds(
  supabase: SupabaseClient<Database>,
  chunkIds: readonly string[],
): Promise<SourceDocumentChunk[]> {
  if (chunkIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("source_document_chunks")
    .select("*")
    .in("id", chunkIds);

  if (error || !data) {
    return [];
  }
  return data.map(mapSourceDocumentChunkRow);
}
