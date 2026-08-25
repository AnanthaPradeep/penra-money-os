// A deliberately narrow, hand-maintained `Database`-shaped type — NOT a
// copy of the full app-generated src/types/database.types.ts (that file is
// ~3,900 lines; bundling it whole into every Edge Function deploy payload
// was tried and rejected as impractical, and it would carry ~150 tables'
// worth of irrelevant type surface for what these three functions
// actually touch). This file covers exactly the tables and RPCs the Edge
// Functions in this directory call, structured identically to what
// `supabase gen types typescript` would produce for the same slice, so
// `createClient<Database>(...)` gives real `.from()/.rpc()` type-checking
// instead of resolving to an untyped boundary — this is the codebase's
// chosen implementation of the "isolate the untyped Supabase boundary
// behind typed adapter" fallback from the Phase 9 spec (bundling the full
// generated file was the preferred option but wasn't practical given the
// deploy tool's inline-payload constraint).
//
// Keep in sync by hand whenever a touched table/column/RPC signature
// changes in a migration — cross-check against
// src/types/database.types.ts, the actual generated source of truth.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      market_instruments: {
        Row: {
          id: string;
          provider: string;
          provider_instrument_id: string;
          symbol: string | null;
          exchange: string | null;
          mic: string | null;
          isin: string | null;
          name: string;
          instrument_kind: string;
          quote_currency: string;
          timezone: string;
          is_active: boolean;
          last_successful_refresh_at: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          provider_instrument_id: string;
          symbol?: string | null;
          exchange?: string | null;
          mic?: string | null;
          isin?: string | null;
          name: string;
          instrument_kind: string;
          quote_currency?: string;
          timezone?: string;
          is_active?: boolean;
          last_successful_refresh_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["market_instruments"]["Insert"]
        >;
      };
      market_prices: {
        Row: {
          id: string;
          instrument_id: string;
          price_kind: string;
          effective_date: string;
          price: number;
          currency: string;
          provider: string;
          is_current: boolean;
          superseded_by: string | null;
        };
        Insert: {
          id?: string;
          instrument_id: string;
          price_kind: string;
          effective_date: string;
          price: number;
          currency?: string;
          provider: string;
          is_current?: boolean;
          superseded_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["market_prices"]["Insert"]
        >;
      };
      market_data_sync_runs: {
        Row: {
          id: string;
          provider: string;
          scope: string;
          status: string;
          instruments_requested: number;
          instruments_updated: number;
          instruments_skipped: number;
          error_code: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          scope: string;
          status?: string;
          instruments_requested?: number;
          instruments_updated?: number;
          instruments_skipped?: number;
          error_code?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["market_data_sync_runs"]["Insert"]
        >;
      };
      market_data_provider_state: {
        Row: {
          provider: string;
          is_configured: boolean;
          last_success_at: string | null;
          last_attempt_at: string | null;
          last_error_code: string | null;
          consecutive_failures: number;
        };
        Insert: {
          provider: string;
          is_configured?: boolean;
          last_success_at?: string | null;
          last_attempt_at?: string | null;
          last_error_code?: string | null;
          consecutive_failures?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["market_data_provider_state"]["Insert"]
        >;
      };
      fundamentals_sync_runs: {
        Row: {
          id: string;
          provider: string;
          scope: string;
          status: string;
          instruments_requested: number;
          instruments_updated: number;
          instruments_skipped: number;
          error_code: string | null;
          completed_at: string | null;
          triggered_by_user_id: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          scope: string;
          status?: string;
          instruments_requested?: number;
          instruments_updated?: number;
          instruments_skipped?: number;
          error_code?: string | null;
          completed_at?: string | null;
          triggered_by_user_id?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["fundamentals_sync_runs"]["Insert"]
        >;
      };
      research_sync_runs: {
        Row: {
          id: string;
          scope: string;
          status: string;
          items_requested: number;
          items_updated: number;
          items_skipped: number;
          error_code: string | null;
          triggered_by_user_id: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          scope: string;
          status?: string;
          items_requested?: number;
          items_updated?: number;
          items_skipped?: number;
          error_code?: string | null;
          triggered_by_user_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["research_sync_runs"]["Insert"]
        >;
      };
      ai_jobs: {
        Row: {
          id: string;
          user_id: string;
          job_kind: string;
          provider: string;
          model_id: string;
          status: string;
          scope_type: string;
          scope_instrument_id: string | null;
          scope_ipo_issue_id: string | null;
          scope_compare_instrument_ids: string[] | null;
          question_text: string | null;
          prompt_template_version: string;
          input_hash: string;
          output_hash: string | null;
          requested_at: string;
          started_at: string | null;
          completed_at: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          estimated_cost_usd: number | null;
          duration_ms: number | null;
          error_code: string | null;
          retry_count: number;
          human_review_status: string | null;
        };
        // Never inserted/updated directly by this worker — every write goes
        // through start_ai_job/complete_ai_job/block_ai_job/fail_ai_job.
        // Insert/Update are still given realistic shapes (not `never`) so
        // supabase-js's generic PostgrestQueryBuilder constraints resolve
        // normally, matching every other table in this file.
        Insert: Partial<Database["public"]["Tables"]["ai_jobs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["ai_jobs"]["Row"]>;
      };
      ai_job_sources: {
        Row: {
          id: string;
          job_id: string;
          chunk_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_job_sources"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["ai_job_sources"]["Row"]>;
      };
      source_document_chunks: {
        Row: {
          id: string;
          user_id: string;
          ipo_document_id: string | null;
          company_filing_id: string | null;
          page_number: number | null;
          section_heading: string | null;
          content_text: string;
          content_hash: string;
          extraction_status: string;
          extractor_version: string;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["source_document_chunks"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["source_document_chunks"]["Row"]
        >;
      };
      ai_provider_models: {
        Row: {
          id: string;
          provider: string;
          model_id: string;
          capability: string;
          max_input_tokens: number;
          max_output_tokens: number;
          timeout_seconds: number;
          fallback_model_id: string | null;
          cost_per_1k_input_usd: number | null;
          cost_per_1k_output_usd: number | null;
          per_job_max_output_tokens: number;
          daily_spend_cap_usd: number;
          monthly_spend_cap_usd: number;
          is_enabled: boolean;
        };
        Insert: Partial<
          Database["public"]["Tables"]["ai_provider_models"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["ai_provider_models"]["Row"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: {
      ingest_market_price_observation: {
        Args: {
          p_instrument_id: string;
          p_provider: string;
          p_price_kind: string;
          p_effective_date: string;
          p_price: number | string;
          p_currency?: string;
          p_provider_timestamp?: string | null;
        };
        Returns: {
          id: string;
          instrument_id: string;
          price_kind: string;
          effective_date: string;
          price: number;
          currency: string;
          provider: string;
          is_current: boolean;
          superseded_by: string | null;
        };
      };
      ingest_market_price_observations_batch: {
        Args: {
          p_provider: string;
          p_price_kind: string;
          p_currency: string;
          p_rows: Json;
        };
        Returns: { updated_count: number; skipped_count: number };
      };
      ingest_company_profile: {
        Args: {
          p_instrument_id: string;
          p_provider: string;
          p_legal_name?: string | null;
          p_country?: string | null;
          p_sector?: string | null;
          p_industry?: string | null;
          p_fiscal_year_end?: string | null;
          p_website?: string | null;
          p_description?: string | null;
        };
        Returns: {
          instrument_id: string;
          legal_name: string | null;
          country: string | null;
          sector: string | null;
          industry: string | null;
          fiscal_year_end: string | null;
          website: string | null;
          description: string | null;
          provider: string;
          received_at: string;
        };
      };
      ensure_company_financial_period: {
        Args: {
          p_instrument_id: string;
          p_period_type: string;
          p_fiscal_period_end: string;
          p_fiscal_year: number;
          p_fiscal_quarter: number | null;
          p_report_date: string | null;
          p_currency: string;
          p_statement_basis: string;
          p_provider: string;
        };
        Returns: string;
      };
      ingest_company_financial_metric: {
        Args: {
          p_period_id: string;
          p_statement_type: string;
          p_metric_key: string;
          p_value: number | string;
          p_unit_scale?: string;
          p_provider?: string;
        };
        Returns: {
          id: string;
          period_id: string;
          statement_type: string;
          metric_key: string;
          value: number;
          unit_scale: string;
          provider: string;
          is_current: boolean;
          superseded_by: string | null;
        };
      };
      ingest_company_financial_metrics_batch: {
        Args: { p_rows: Json };
        Returns: { updated_count: number; skipped_count: number };
      };
      ingest_corporate_event: {
        Args: {
          p_instrument_id: string;
          p_event_type: string;
          p_title: string;
          p_source: string;
          p_status?: string;
          p_announcement_at?: string | null;
          p_effective_date?: string | null;
          p_ex_date?: string | null;
          p_record_date?: string | null;
          p_payment_date?: string | null;
          p_meeting_or_result_date?: string | null;
          p_details?: Json;
          p_official_url?: string | null;
          p_provider_event_id?: string | null;
        };
        Returns: {
          id: string;
          instrument_id: string;
          event_type: string;
          title: string;
          announcement_at: string | null;
          effective_date: string | null;
          ex_date: string | null;
          record_date: string | null;
          payment_date: string | null;
          meeting_or_result_date: string | null;
          details: Json;
          status: string;
          source: string;
          official_url: string | null;
          provider_event_id: string | null;
          received_at: string;
          is_current: boolean;
          superseded_by: string | null;
        };
      };
      start_ai_job: {
        Args: { p_job_id: string };
        Returns: undefined;
      };
      complete_ai_job: {
        Args: {
          p_job_id: string;
          p_output_hash: string;
          p_input_tokens: number;
          p_output_tokens: number;
          p_estimated_cost_usd: number;
          p_duration_ms: number;
          p_outputs: Json;
        };
        Returns: undefined;
      };
      block_ai_job: {
        Args: { p_job_id: string; p_error_code: string };
        Returns: undefined;
      };
      fail_ai_job: {
        Args: { p_job_id: string; p_error_code: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
