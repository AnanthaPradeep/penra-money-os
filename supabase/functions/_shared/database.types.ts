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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
