export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          account_class: string;
          account_type: string;
          closed_on: string | null;
          created_at: string;
          credit_limit: number | null;
          currency: string;
          id: string;
          institution_id: string | null;
          is_archived: boolean;
          is_system: boolean;
          last_four: string | null;
          name: string;
          notes: string | null;
          opened_on: string | null;
          system_code: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_class: string;
          account_type: string;
          closed_on?: string | null;
          created_at?: string;
          credit_limit?: number | null;
          currency?: string;
          id?: string;
          institution_id?: string | null;
          is_archived?: boolean;
          is_system?: boolean;
          last_four?: string | null;
          name: string;
          notes?: string | null;
          opened_on?: string | null;
          system_code?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_class?: string;
          account_type?: string;
          closed_on?: string | null;
          created_at?: string;
          credit_limit?: number | null;
          currency?: string;
          id?: string;
          institution_id?: string | null;
          is_archived?: boolean;
          is_system?: boolean;
          last_four?: string | null;
          name?: string;
          notes?: string | null;
          opened_on?: string | null;
          system_code?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_job_outputs: {
        Row: {
          accepted: boolean;
          accepted_at: string | null;
          citations: Json;
          content: string;
          created_at: string;
          display_order: number;
          id: string;
          is_user_edited: boolean;
          job_id: string;
          saved_as_id: string | null;
          saved_as_table: string | null;
          section_type: string;
        };
        Insert: {
          accepted?: boolean;
          accepted_at?: string | null;
          citations?: Json;
          content: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_user_edited?: boolean;
          job_id: string;
          saved_as_id?: string | null;
          saved_as_table?: string | null;
          section_type: string;
        };
        Update: {
          accepted?: boolean;
          accepted_at?: string | null;
          citations?: Json;
          content?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_user_edited?: boolean;
          job_id?: string;
          saved_as_id?: string | null;
          saved_as_table?: string | null;
          section_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_job_outputs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "ai_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_job_sources: {
        Row: {
          chunk_id: string;
          created_at: string;
          id: string;
          job_id: string;
        };
        Insert: {
          chunk_id: string;
          created_at?: string;
          id?: string;
          job_id: string;
        };
        Update: {
          chunk_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_job_sources_chunk_id_fkey";
            columns: ["chunk_id"];
            isOneToOne: false;
            referencedRelation: "source_document_chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_job_sources_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "ai_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_jobs: {
        Row: {
          completed_at: string | null;
          duration_ms: number | null;
          error_code: string | null;
          estimated_cost_usd: number | null;
          human_review_status: string | null;
          id: string;
          input_hash: string;
          input_tokens: number | null;
          job_kind: string;
          model_id: string;
          output_hash: string | null;
          output_tokens: number | null;
          prompt_template_version: string;
          provider: string;
          question_text: string | null;
          requested_at: string;
          retry_count: number;
          scope_compare_instrument_ids: string[] | null;
          scope_instrument_id: string | null;
          scope_ipo_issue_id: string | null;
          scope_type: string;
          started_at: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          duration_ms?: number | null;
          error_code?: string | null;
          estimated_cost_usd?: number | null;
          human_review_status?: string | null;
          id?: string;
          input_hash: string;
          input_tokens?: number | null;
          job_kind: string;
          model_id: string;
          output_hash?: string | null;
          output_tokens?: number | null;
          prompt_template_version: string;
          provider: string;
          question_text?: string | null;
          requested_at?: string;
          retry_count?: number;
          scope_compare_instrument_ids?: string[] | null;
          scope_instrument_id?: string | null;
          scope_ipo_issue_id?: string | null;
          scope_type: string;
          started_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          duration_ms?: number | null;
          error_code?: string | null;
          estimated_cost_usd?: number | null;
          human_review_status?: string | null;
          id?: string;
          input_hash?: string;
          input_tokens?: number | null;
          job_kind?: string;
          model_id?: string;
          output_hash?: string | null;
          output_tokens?: number | null;
          prompt_template_version?: string;
          provider?: string;
          question_text?: string | null;
          requested_at?: string;
          retry_count?: number;
          scope_compare_instrument_ids?: string[] | null;
          scope_instrument_id?: string | null;
          scope_ipo_issue_id?: string | null;
          scope_type?: string;
          started_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_jobs_scope_instrument_id_fkey";
            columns: ["scope_instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_jobs_scope_ipo_issue_id_fkey";
            columns: ["scope_ipo_issue_id"];
            isOneToOne: false;
            referencedRelation: "ipo_issues";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_provider_models: {
        Row: {
          capability: string;
          cost_per_1k_input_usd: number | null;
          cost_per_1k_output_usd: number | null;
          created_at: string;
          daily_spend_cap_usd: number;
          fallback_model_id: string | null;
          id: string;
          is_enabled: boolean;
          max_input_tokens: number;
          max_output_tokens: number;
          model_id: string;
          monthly_spend_cap_usd: number;
          per_job_max_output_tokens: number;
          provider: string;
          timeout_seconds: number;
          updated_at: string;
        };
        Insert: {
          capability: string;
          cost_per_1k_input_usd?: number | null;
          cost_per_1k_output_usd?: number | null;
          created_at?: string;
          daily_spend_cap_usd?: number;
          fallback_model_id?: string | null;
          id?: string;
          is_enabled?: boolean;
          max_input_tokens: number;
          max_output_tokens: number;
          model_id: string;
          monthly_spend_cap_usd?: number;
          per_job_max_output_tokens: number;
          provider: string;
          timeout_seconds?: number;
          updated_at?: string;
        };
        Update: {
          capability?: string;
          cost_per_1k_input_usd?: number | null;
          cost_per_1k_output_usd?: number | null;
          created_at?: string;
          daily_spend_cap_usd?: number;
          fallback_model_id?: string | null;
          id?: string;
          is_enabled?: boolean;
          max_input_tokens?: number;
          max_output_tokens?: number;
          model_id?: string;
          monthly_spend_cap_usd?: number;
          per_job_max_output_tokens?: number;
          provider?: string;
          timeout_seconds?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_usage_daily: {
        Row: {
          estimated_cost_usd: number;
          id: string;
          input_tokens: number;
          jobs_count: number;
          output_tokens: number;
          updated_at: string;
          usage_date: string;
          user_id: string;
        };
        Insert: {
          estimated_cost_usd?: number;
          id?: string;
          input_tokens?: number;
          jobs_count?: number;
          output_tokens?: number;
          updated_at?: string;
          usage_date: string;
          user_id: string;
        };
        Update: {
          estimated_cost_usd?: number;
          id?: string;
          input_tokens?: number;
          jobs_count?: number;
          output_tokens?: number;
          updated_at?: string;
          usage_date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      budget_allocations: {
        Row: {
          budget_period_id: string;
          category_id: string;
          created_at: string;
          id: string;
          notes: string | null;
          planned_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          budget_period_id: string;
          category_id: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          planned_amount: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget_period_id?: string;
          category_id?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          planned_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_allocations_budget_period_id_fkey";
            columns: ["budget_period_id"];
            isOneToOne: false;
            referencedRelation: "budget_periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_allocations_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_periods: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          notes: string | null;
          period_month: string;
          planned_income: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          notes?: string | null;
          period_month: string;
          planned_income?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          notes?: string | null;
          period_month?: string;
          planned_income?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          category_type: string;
          color: string | null;
          created_at: string;
          icon: string | null;
          id: string;
          is_archived: boolean;
          is_system: boolean;
          name: string;
          normalized_name: string;
          parent_id: string | null;
          slug: string | null;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_type: string;
          color?: string | null;
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_archived?: boolean;
          is_system?: boolean;
          name: string;
          normalized_name: string;
          parent_id?: string | null;
          slug?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_type?: string;
          color?: string | null;
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_archived?: boolean;
          is_system?: boolean;
          name?: string;
          normalized_name?: string;
          parent_id?: string | null;
          slug?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      company_filings: {
        Row: {
          category: string;
          created_at: string;
          filing_date: string | null;
          id: string;
          instrument_id: string;
          is_verified: boolean;
          notes: string | null;
          provider_document_id: string | null;
          source_domain: string;
          source_url: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          filing_date?: string | null;
          id?: string;
          instrument_id: string;
          is_verified?: boolean;
          notes?: string | null;
          provider_document_id?: string | null;
          source_domain: string;
          source_url: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          filing_date?: string | null;
          id?: string;
          instrument_id?: string;
          is_verified?: boolean;
          notes?: string | null;
          provider_document_id?: string | null;
          source_domain?: string;
          source_url?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_filings_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      company_financial_metrics: {
        Row: {
          created_at: string;
          id: string;
          is_current: boolean;
          metric_key: string;
          period_id: string;
          provider: string;
          received_at: string;
          statement_type: string;
          superseded_by: string | null;
          unit_scale: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_current?: boolean;
          metric_key: string;
          period_id: string;
          provider: string;
          received_at?: string;
          statement_type: string;
          superseded_by?: string | null;
          unit_scale?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_current?: boolean;
          metric_key?: string;
          period_id?: string;
          provider?: string;
          received_at?: string;
          statement_type?: string;
          superseded_by?: string | null;
          unit_scale?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "company_financial_metrics_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "company_financial_periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_financial_metrics_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "company_financial_metrics";
            referencedColumns: ["id"];
          },
        ];
      };
      company_financial_periods: {
        Row: {
          created_at: string;
          currency: string;
          fiscal_period_end: string;
          fiscal_quarter: number | null;
          fiscal_year: number;
          id: string;
          instrument_id: string;
          is_current: boolean;
          period_type: string;
          provider: string;
          received_at: string;
          report_date: string | null;
          statement_basis: string;
          superseded_by: string | null;
        };
        Insert: {
          created_at?: string;
          currency: string;
          fiscal_period_end: string;
          fiscal_quarter?: number | null;
          fiscal_year: number;
          id?: string;
          instrument_id: string;
          is_current?: boolean;
          period_type: string;
          provider: string;
          received_at?: string;
          report_date?: string | null;
          statement_basis?: string;
          superseded_by?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          fiscal_period_end?: string;
          fiscal_quarter?: number | null;
          fiscal_year?: number;
          id?: string;
          instrument_id?: string;
          is_current?: boolean;
          period_type?: string;
          provider?: string;
          received_at?: string;
          report_date?: string | null;
          statement_basis?: string;
          superseded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "company_financial_periods_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_financial_periods_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "company_financial_periods";
            referencedColumns: ["id"];
          },
        ];
      };
      company_profiles: {
        Row: {
          country: string | null;
          created_at: string;
          description: string | null;
          fiscal_year_end: string | null;
          industry: string | null;
          instrument_id: string;
          legal_name: string | null;
          provider: string;
          received_at: string;
          sector: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          country?: string | null;
          created_at?: string;
          description?: string | null;
          fiscal_year_end?: string | null;
          industry?: string | null;
          instrument_id: string;
          legal_name?: string | null;
          provider: string;
          received_at?: string;
          sector?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          description?: string | null;
          fiscal_year_end?: string | null;
          industry?: string | null;
          instrument_id?: string;
          legal_name?: string | null;
          provider?: string;
          received_at?: string;
          sector?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "company_profiles_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: true;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_events: {
        Row: {
          announcement_at: string | null;
          created_at: string;
          details: Json;
          effective_date: string | null;
          event_type: string;
          ex_date: string | null;
          id: string;
          instrument_id: string;
          is_current: boolean;
          meeting_or_result_date: string | null;
          official_url: string | null;
          payment_date: string | null;
          provider_event_id: string | null;
          received_at: string;
          record_date: string | null;
          source: string;
          status: string;
          superseded_by: string | null;
          title: string;
        };
        Insert: {
          announcement_at?: string | null;
          created_at?: string;
          details?: Json;
          effective_date?: string | null;
          event_type: string;
          ex_date?: string | null;
          id?: string;
          instrument_id: string;
          is_current?: boolean;
          meeting_or_result_date?: string | null;
          official_url?: string | null;
          payment_date?: string | null;
          provider_event_id?: string | null;
          received_at?: string;
          record_date?: string | null;
          source: string;
          status?: string;
          superseded_by?: string | null;
          title: string;
        };
        Update: {
          announcement_at?: string | null;
          created_at?: string;
          details?: Json;
          effective_date?: string | null;
          event_type?: string;
          ex_date?: string | null;
          id?: string;
          instrument_id?: string;
          is_current?: boolean;
          meeting_or_result_date?: string | null;
          official_url?: string | null;
          payment_date?: string | null;
          provider_event_id?: string | null;
          received_at?: string;
          record_date?: string | null;
          source?: string;
          status?: string;
          superseded_by?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_events_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_events_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "corporate_events";
            referencedColumns: ["id"];
          },
        ];
      };
      fixed_income_details: {
        Row: {
          actual_maturity_amount: number | null;
          compounding_frequency: string | null;
          created_at: string;
          expected_maturity_amount: number | null;
          holding_id: string;
          id: string;
          installment_amount: number | null;
          interest_payout_mode: string | null;
          interest_rate: number | null;
          kind: string;
          maturity_date: string | null;
          notes: string | null;
          planned_installments: number | null;
          principal_amount: number | null;
          provider: string | null;
          recurring_item_id: string | null;
          start_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actual_maturity_amount?: number | null;
          compounding_frequency?: string | null;
          created_at?: string;
          expected_maturity_amount?: number | null;
          holding_id: string;
          id?: string;
          installment_amount?: number | null;
          interest_payout_mode?: string | null;
          interest_rate?: number | null;
          kind: string;
          maturity_date?: string | null;
          notes?: string | null;
          planned_installments?: number | null;
          principal_amount?: number | null;
          provider?: string | null;
          recurring_item_id?: string | null;
          start_date: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          actual_maturity_amount?: number | null;
          compounding_frequency?: string | null;
          created_at?: string;
          expected_maturity_amount?: number | null;
          holding_id?: string;
          id?: string;
          installment_amount?: number | null;
          interest_payout_mode?: string | null;
          interest_rate?: number | null;
          kind?: string;
          maturity_date?: string | null;
          notes?: string | null;
          planned_installments?: number | null;
          principal_amount?: number | null;
          provider?: string | null;
          recurring_item_id?: string | null;
          start_date?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fixed_income_details_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: true;
            referencedRelation: "investment_holdings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixed_income_details_recurring_item_id_fkey";
            columns: ["recurring_item_id"];
            isOneToOne: false;
            referencedRelation: "recurring_items";
            referencedColumns: ["id"];
          },
        ];
      };
      fundamentals_sync_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          id: string;
          instruments_requested: number;
          instruments_skipped: number;
          instruments_updated: number;
          provider: string;
          rate_limit_remaining: number | null;
          retry_count: number;
          scope: string;
          started_at: string;
          status: string;
          triggered_by_user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          instruments_requested?: number;
          instruments_skipped?: number;
          instruments_updated?: number;
          provider: string;
          rate_limit_remaining?: number | null;
          retry_count?: number;
          scope: string;
          started_at?: string;
          status?: string;
          triggered_by_user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          instruments_requested?: number;
          instruments_skipped?: number;
          instruments_updated?: number;
          provider?: string;
          rate_limit_remaining?: number | null;
          retry_count?: number;
          scope?: string;
          started_at?: string;
          status?: string;
          triggered_by_user_id?: string | null;
        };
        Relationships: [];
      };
      institutions: {
        Row: {
          created_at: string;
          id: string;
          institution_type: string;
          is_archived: boolean;
          name: string;
          notes: string | null;
          updated_at: string;
          user_id: string;
          website: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          institution_type: string;
          is_archived?: boolean;
          name: string;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          institution_type?: string;
          is_archived?: boolean;
          name?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      investment_activities: {
        Row: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          activity_kind: string;
          category_id?: string | null;
          cost_basis_amount?: number | null;
          created_at?: string;
          currency?: string;
          fee_amount?: number;
          gross_amount: number;
          holding_id: string;
          id?: string;
          idempotency_key?: string | null;
          ledger_transaction_id?: string | null;
          notes?: string | null;
          payee_id?: string | null;
          quantity?: number | null;
          realized_gain_amount?: number | null;
          reversal_of?: string | null;
          reversed_by?: string | null;
          settlement_date?: string | null;
          status?: string;
          tax_amount?: number;
          trade_date: string;
          unit_price?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          activity_kind?: string;
          category_id?: string | null;
          cost_basis_amount?: number | null;
          created_at?: string;
          currency?: string;
          fee_amount?: number;
          gross_amount?: number;
          holding_id?: string;
          id?: string;
          idempotency_key?: string | null;
          ledger_transaction_id?: string | null;
          notes?: string | null;
          payee_id?: string | null;
          quantity?: number | null;
          realized_gain_amount?: number | null;
          reversal_of?: string | null;
          reversed_by?: string | null;
          settlement_date?: string | null;
          status?: string;
          tax_amount?: number;
          trade_date?: string;
          unit_price?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investment_activities_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_activities_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: false;
            referencedRelation: "investment_holdings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_activities_ledger_transaction_id_fkey";
            columns: ["ledger_transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_activities_payee_id_fkey";
            columns: ["payee_id"];
            isOneToOne: false;
            referencedRelation: "payees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_activities_reversal_of_fkey";
            columns: ["reversal_of"];
            isOneToOne: false;
            referencedRelation: "investment_activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_activities_reversed_by_fkey";
            columns: ["reversed_by"];
            isOneToOne: false;
            referencedRelation: "investment_activities";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_assets: {
        Row: {
          asset_kind: string;
          created_at: string;
          currency: string;
          display_name: string;
          exchange: string | null;
          id: string;
          investment_account_id: string | null;
          isin: string | null;
          market_instrument_id: string | null;
          market_link_confirmed_at: string | null;
          notes: string | null;
          scheme_code: string | null;
          status: string;
          symbol: string | null;
          unit_precision: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset_kind: string;
          created_at?: string;
          currency?: string;
          display_name: string;
          exchange?: string | null;
          id?: string;
          investment_account_id?: string | null;
          isin?: string | null;
          market_instrument_id?: string | null;
          market_link_confirmed_at?: string | null;
          notes?: string | null;
          scheme_code?: string | null;
          status?: string;
          symbol?: string | null;
          unit_precision?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asset_kind?: string;
          created_at?: string;
          currency?: string;
          display_name?: string;
          exchange?: string | null;
          id?: string;
          investment_account_id?: string | null;
          isin?: string | null;
          market_instrument_id?: string | null;
          market_link_confirmed_at?: string | null;
          notes?: string | null;
          scheme_code?: string | null;
          status?: string;
          symbol?: string | null;
          unit_precision?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investment_assets_investment_account_id_fkey";
            columns: ["investment_account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "investment_assets_investment_account_id_fkey";
            columns: ["investment_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_assets_market_instrument_id_fkey";
            columns: ["market_instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_holdings: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          investment_account_id: string | null;
          investment_asset_id: string;
          opened_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          investment_account_id?: string | null;
          investment_asset_id: string;
          opened_date: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          investment_account_id?: string | null;
          investment_asset_id?: string;
          opened_date?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investment_holdings_investment_account_id_fkey";
            columns: ["investment_account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "investment_holdings_investment_account_id_fkey";
            columns: ["investment_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_holdings_investment_asset_id_fkey";
            columns: ["investment_asset_id"];
            isOneToOne: false;
            referencedRelation: "investment_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_ideas: {
        Row: {
          created_at: string;
          id: string;
          instrument_id: string;
          next_review_date: string | null;
          origin: string | null;
          priority: string;
          rationale: string | null;
          risk_notes: string | null;
          status: string;
          thesis_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          instrument_id: string;
          next_review_date?: string | null;
          origin?: string | null;
          priority?: string;
          rationale?: string | null;
          risk_notes?: string | null;
          status?: string;
          thesis_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          instrument_id?: string;
          next_review_date?: string | null;
          origin?: string | null;
          priority?: string;
          rationale?: string | null;
          risk_notes?: string | null;
          status?: string;
          thesis_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investment_ideas_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_ideas_thesis_id_fkey";
            columns: ["thesis_id"];
            isOneToOne: false;
            referencedRelation: "investment_theses";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_theses: {
        Row: {
          catalysts: string | null;
          confidence: string;
          created_at: string;
          current_version: number;
          expected_review_date: string | null;
          id: string;
          instrument_id: string;
          invalidation_conditions: string | null;
          investment_case: string | null;
          opportunities: string | null;
          risks: string | null;
          status: string;
          summary: string | null;
          time_horizon: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          catalysts?: string | null;
          confidence?: string;
          created_at?: string;
          current_version?: number;
          expected_review_date?: string | null;
          id?: string;
          instrument_id: string;
          invalidation_conditions?: string | null;
          investment_case?: string | null;
          opportunities?: string | null;
          risks?: string | null;
          status?: string;
          summary?: string | null;
          time_horizon?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          catalysts?: string | null;
          confidence?: string;
          created_at?: string;
          current_version?: number;
          expected_review_date?: string | null;
          id?: string;
          instrument_id?: string;
          invalidation_conditions?: string | null;
          investment_case?: string | null;
          opportunities?: string | null;
          risks?: string | null;
          status?: string;
          summary?: string | null;
          time_horizon?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investment_theses_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_thesis_versions: {
        Row: {
          catalysts: string | null;
          confidence: string;
          created_at: string;
          id: string;
          invalidation_conditions: string | null;
          investment_case: string | null;
          opportunities: string | null;
          risks: string | null;
          status: string;
          summary: string | null;
          thesis_id: string;
          time_horizon: string;
          title: string;
          user_id: string;
          version: number;
        };
        Insert: {
          catalysts?: string | null;
          confidence: string;
          created_at?: string;
          id?: string;
          invalidation_conditions?: string | null;
          investment_case?: string | null;
          opportunities?: string | null;
          risks?: string | null;
          status: string;
          summary?: string | null;
          thesis_id: string;
          time_horizon: string;
          title: string;
          user_id: string;
          version: number;
        };
        Update: {
          catalysts?: string | null;
          confidence?: string;
          created_at?: string;
          id?: string;
          invalidation_conditions?: string | null;
          investment_case?: string | null;
          opportunities?: string | null;
          risks?: string | null;
          status?: string;
          summary?: string | null;
          thesis_id?: string;
          time_horizon?: string;
          title?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "investment_thesis_versions_thesis_id_fkey";
            columns: ["thesis_id"];
            isOneToOne: false;
            referencedRelation: "investment_theses";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_valuations: {
        Row: {
          created_at: string;
          currency: string;
          holding_id: string;
          id: string;
          note: string | null;
          source: string;
          total_value: number;
          unit_value: number | null;
          user_id: string;
          valued_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          holding_id: string;
          id?: string;
          note?: string | null;
          source?: string;
          total_value: number;
          unit_value?: number | null;
          user_id: string;
          valued_at: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          holding_id?: string;
          id?: string;
          note?: string | null;
          source?: string;
          total_value?: number;
          unit_value?: number | null;
          user_id?: string;
          valued_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investment_valuations_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: false;
            referencedRelation: "investment_holdings";
            referencedColumns: ["id"];
          },
        ];
      };
      ipo_documents: {
        Row: {
          added_by_user_id: string;
          content_hash: string | null;
          created_at: string;
          document_type: string;
          filing_date: string | null;
          id: string;
          ipo_issue_id: string;
          is_verified: boolean;
          retrieved_at: string | null;
          source_organization: string;
          source_page_url: string | null;
          source_url: string;
          supersedes_document_id: string | null;
          title: string;
        };
        Insert: {
          added_by_user_id: string;
          content_hash?: string | null;
          created_at?: string;
          document_type: string;
          filing_date?: string | null;
          id?: string;
          ipo_issue_id: string;
          is_verified?: boolean;
          retrieved_at?: string | null;
          source_organization: string;
          source_page_url?: string | null;
          source_url: string;
          supersedes_document_id?: string | null;
          title: string;
        };
        Update: {
          added_by_user_id?: string;
          content_hash?: string | null;
          created_at?: string;
          document_type?: string;
          filing_date?: string | null;
          id?: string;
          ipo_issue_id?: string;
          is_verified?: boolean;
          retrieved_at?: string | null;
          source_organization?: string;
          source_page_url?: string | null;
          source_url?: string;
          supersedes_document_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ipo_documents_ipo_issue_id_fkey";
            columns: ["ipo_issue_id"];
            isOneToOne: false;
            referencedRelation: "ipo_issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ipo_documents_supersedes_document_id_fkey";
            columns: ["supersedes_document_id"];
            isOneToOne: false;
            referencedRelation: "ipo_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      ipo_financial_metrics: {
        Row: {
          added_by_user_id: string;
          created_at: string;
          currency: string;
          extraction_method: string;
          fiscal_period_end: string;
          human_verified: boolean;
          id: string;
          ipo_issue_id: string;
          is_current: boolean;
          metric_key: string;
          source_citation: string | null;
          source_document_id: string | null;
          statement_basis: string;
          superseded_by: string | null;
          unit_scale: string;
          value: number;
        };
        Insert: {
          added_by_user_id: string;
          created_at?: string;
          currency?: string;
          extraction_method?: string;
          fiscal_period_end: string;
          human_verified?: boolean;
          id?: string;
          ipo_issue_id: string;
          is_current?: boolean;
          metric_key: string;
          source_citation?: string | null;
          source_document_id?: string | null;
          statement_basis?: string;
          superseded_by?: string | null;
          unit_scale?: string;
          value: number;
        };
        Update: {
          added_by_user_id?: string;
          created_at?: string;
          currency?: string;
          extraction_method?: string;
          fiscal_period_end?: string;
          human_verified?: boolean;
          id?: string;
          ipo_issue_id?: string;
          is_current?: boolean;
          metric_key?: string;
          source_citation?: string | null;
          source_document_id?: string | null;
          statement_basis?: string;
          superseded_by?: string | null;
          unit_scale?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ipo_financial_metrics_ipo_issue_id_fkey";
            columns: ["ipo_issue_id"];
            isOneToOne: false;
            referencedRelation: "ipo_issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ipo_financial_metrics_source_document_id_fkey";
            columns: ["source_document_id"];
            isOneToOne: false;
            referencedRelation: "ipo_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ipo_financial_metrics_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "ipo_financial_metrics";
            referencedColumns: ["id"];
          },
        ];
      };
      ipo_issues: {
        Row: {
          added_by_user_id: string;
          anchor_date: string | null;
          basis_of_allotment_date: string | null;
          board: string;
          cin: string | null;
          created_at: string;
          demat_credit_date: string | null;
          exchange: string | null;
          face_value: number | null;
          final_issue_price: number | null;
          fresh_issue_amount: number | null;
          id: string;
          industry: string | null;
          isin: string | null;
          issue_close_date: string | null;
          issue_open_date: string | null;
          issue_type: string;
          issuer_name: string;
          last_verified_at: string;
          linked_confirmed_at: string | null;
          linked_instrument_id: string | null;
          listing_date: string | null;
          lot_size: number | null;
          min_application_quantity: number | null;
          offer_for_sale_amount: number | null;
          price_band_max: number | null;
          price_band_min: number | null;
          refund_date: string | null;
          source_organization: string;
          source_url: string;
          status: string;
          total_issue_size: number | null;
          updated_at: string;
        };
        Insert: {
          added_by_user_id: string;
          anchor_date?: string | null;
          basis_of_allotment_date?: string | null;
          board?: string;
          cin?: string | null;
          created_at?: string;
          demat_credit_date?: string | null;
          exchange?: string | null;
          face_value?: number | null;
          final_issue_price?: number | null;
          fresh_issue_amount?: number | null;
          id?: string;
          industry?: string | null;
          isin?: string | null;
          issue_close_date?: string | null;
          issue_open_date?: string | null;
          issue_type?: string;
          issuer_name: string;
          last_verified_at?: string;
          linked_confirmed_at?: string | null;
          linked_instrument_id?: string | null;
          listing_date?: string | null;
          lot_size?: number | null;
          min_application_quantity?: number | null;
          offer_for_sale_amount?: number | null;
          price_band_max?: number | null;
          price_band_min?: number | null;
          refund_date?: string | null;
          source_organization: string;
          source_url: string;
          status?: string;
          total_issue_size?: number | null;
          updated_at?: string;
        };
        Update: {
          added_by_user_id?: string;
          anchor_date?: string | null;
          basis_of_allotment_date?: string | null;
          board?: string;
          cin?: string | null;
          created_at?: string;
          demat_credit_date?: string | null;
          exchange?: string | null;
          face_value?: number | null;
          final_issue_price?: number | null;
          fresh_issue_amount?: number | null;
          id?: string;
          industry?: string | null;
          isin?: string | null;
          issue_close_date?: string | null;
          issue_open_date?: string | null;
          issue_type?: string;
          issuer_name?: string;
          last_verified_at?: string;
          linked_confirmed_at?: string | null;
          linked_instrument_id?: string | null;
          listing_date?: string | null;
          lot_size?: number | null;
          min_application_quantity?: number | null;
          offer_for_sale_amount?: number | null;
          price_band_max?: number | null;
          price_band_min?: number | null;
          refund_date?: string | null;
          source_organization?: string;
          source_url?: string;
          status?: string;
          total_issue_size?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ipo_issues_linked_instrument_id_fkey";
            columns: ["linked_instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      ipo_research_notes: {
        Row: {
          business_overview: string | null;
          cash_flow_notes: string | null;
          concentration_risk: string | null;
          created_at: string;
          debt_notes: string | null;
          dilution_notes: string | null;
          id: string;
          industry_context: string | null;
          ipo_issue_id: string;
          is_ai_reviewed_edited: boolean;
          material_litigations: string | null;
          personal_note: string | null;
          promoters_management: string | null;
          related_party_concerns: string | null;
          revenue_model: string | null;
          risk_checklist: Json;
          risks: string | null;
          source_ai_job_id: string | null;
          source_checklist: Json;
          strengths: string | null;
          unanswered_questions: string | null;
          updated_at: string;
          use_of_proceeds: string | null;
          user_id: string;
          valuation_observations: string | null;
        };
        Insert: {
          business_overview?: string | null;
          cash_flow_notes?: string | null;
          concentration_risk?: string | null;
          created_at?: string;
          debt_notes?: string | null;
          dilution_notes?: string | null;
          id?: string;
          industry_context?: string | null;
          ipo_issue_id: string;
          is_ai_reviewed_edited?: boolean;
          material_litigations?: string | null;
          personal_note?: string | null;
          promoters_management?: string | null;
          related_party_concerns?: string | null;
          revenue_model?: string | null;
          risk_checklist?: Json;
          risks?: string | null;
          source_ai_job_id?: string | null;
          source_checklist?: Json;
          strengths?: string | null;
          unanswered_questions?: string | null;
          updated_at?: string;
          use_of_proceeds?: string | null;
          user_id: string;
          valuation_observations?: string | null;
        };
        Update: {
          business_overview?: string | null;
          cash_flow_notes?: string | null;
          concentration_risk?: string | null;
          created_at?: string;
          debt_notes?: string | null;
          dilution_notes?: string | null;
          id?: string;
          industry_context?: string | null;
          ipo_issue_id?: string;
          is_ai_reviewed_edited?: boolean;
          material_litigations?: string | null;
          personal_note?: string | null;
          promoters_management?: string | null;
          related_party_concerns?: string | null;
          revenue_model?: string | null;
          risk_checklist?: Json;
          risks?: string | null;
          source_ai_job_id?: string | null;
          source_checklist?: Json;
          strengths?: string | null;
          unanswered_questions?: string | null;
          updated_at?: string;
          use_of_proceeds?: string | null;
          user_id?: string;
          valuation_observations?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ipo_research_notes_ipo_issue_id_fkey";
            columns: ["ipo_issue_id"];
            isOneToOne: false;
            referencedRelation: "ipo_issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ipo_research_notes_source_ai_job_id_fkey";
            columns: ["source_ai_job_id"];
            isOneToOne: false;
            referencedRelation: "ai_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      ipo_status_history: {
        Row: {
          changed_at: string;
          changed_by_user_id: string | null;
          id: string;
          ipo_issue_id: string;
          new_status: string;
          note: string | null;
          previous_status: string | null;
        };
        Insert: {
          changed_at?: string;
          changed_by_user_id?: string | null;
          id?: string;
          ipo_issue_id: string;
          new_status: string;
          note?: string | null;
          previous_status?: string | null;
        };
        Update: {
          changed_at?: string;
          changed_by_user_id?: string | null;
          id?: string;
          ipo_issue_id?: string;
          new_status?: string;
          note?: string | null;
          previous_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ipo_status_history_ipo_issue_id_fkey";
            columns: ["ipo_issue_id"];
            isOneToOne: false;
            referencedRelation: "ipo_issues";
            referencedColumns: ["id"];
          },
        ];
      };
      ipo_watchlist_items: {
        Row: {
          added_at: string;
          id: string;
          ipo_issue_id: string;
          priority: string;
          research_status: string;
          target_review_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          id?: string;
          ipo_issue_id: string;
          priority?: string;
          research_status?: string;
          target_review_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          id?: string;
          ipo_issue_id?: string;
          priority?: string;
          research_status?: string;
          target_review_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ipo_watchlist_items_ipo_issue_id_fkey";
            columns: ["ipo_issue_id"];
            isOneToOne: false;
            referencedRelation: "ipo_issues";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          account_id: string;
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          memo: string | null;
          transaction_id: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          amount: number;
          created_at?: string;
          currency?: string;
          id?: string;
          memo?: string | null;
          transaction_id: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          memo?: string | null;
          transaction_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "ledger_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_transactions: {
        Row: {
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
          payee_id: string | null;
          replaces_transaction_id: string | null;
          reversal_of: string | null;
          reversed_by: string | null;
          source_reference: string | null;
          source_type: string;
          status: string;
          transaction_type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          notes?: string | null;
          occurred_at: string;
          payee_id?: string | null;
          replaces_transaction_id?: string | null;
          reversal_of?: string | null;
          reversed_by?: string | null;
          source_reference?: string | null;
          source_type?: string;
          status?: string;
          transaction_type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          payee_id?: string | null;
          replaces_transaction_id?: string | null;
          reversal_of?: string | null;
          reversed_by?: string | null;
          source_reference?: string | null;
          source_type?: string;
          status?: string;
          transaction_type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_transactions_payee_id_fkey";
            columns: ["payee_id"];
            isOneToOne: false;
            referencedRelation: "payees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_transactions_replaces_transaction_id_fkey";
            columns: ["replaces_transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_transactions_reversal_of_fkey";
            columns: ["reversal_of"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_transactions_reversed_by_fkey";
            columns: ["reversed_by"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      market_data_provider_state: {
        Row: {
          consecutive_failures: number;
          is_configured: boolean;
          last_attempt_at: string | null;
          last_error_code: string | null;
          last_success_at: string | null;
          notes: string | null;
          provider: string;
          updated_at: string;
        };
        Insert: {
          consecutive_failures?: number;
          is_configured?: boolean;
          last_attempt_at?: string | null;
          last_error_code?: string | null;
          last_success_at?: string | null;
          notes?: string | null;
          provider: string;
          updated_at?: string;
        };
        Update: {
          consecutive_failures?: number;
          is_configured?: boolean;
          last_attempt_at?: string | null;
          last_error_code?: string | null;
          last_success_at?: string | null;
          notes?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      market_data_sync_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          id: string;
          instruments_requested: number;
          instruments_skipped: number;
          instruments_updated: number;
          provider: string;
          rate_limit_remaining: number | null;
          retry_count: number;
          scope: string;
          started_at: string;
          status: string;
          triggered_by_user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          instruments_requested?: number;
          instruments_skipped?: number;
          instruments_updated?: number;
          provider: string;
          rate_limit_remaining?: number | null;
          retry_count?: number;
          scope: string;
          started_at?: string;
          status?: string;
          triggered_by_user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          instruments_requested?: number;
          instruments_skipped?: number;
          instruments_updated?: number;
          provider?: string;
          rate_limit_remaining?: number | null;
          retry_count?: number;
          scope?: string;
          started_at?: string;
          status?: string;
          triggered_by_user_id?: string | null;
        };
        Relationships: [];
      };
      market_instruments: {
        Row: {
          created_at: string;
          exchange: string | null;
          id: string;
          instrument_kind: string;
          is_active: boolean;
          isin: string | null;
          last_successful_refresh_at: string | null;
          mic: string | null;
          name: string;
          provider: string;
          provider_instrument_id: string;
          quote_currency: string;
          symbol: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          exchange?: string | null;
          id?: string;
          instrument_kind: string;
          is_active?: boolean;
          isin?: string | null;
          last_successful_refresh_at?: string | null;
          mic?: string | null;
          name: string;
          provider: string;
          provider_instrument_id: string;
          quote_currency?: string;
          symbol?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exchange?: string | null;
          id?: string;
          instrument_kind?: string;
          is_active?: boolean;
          isin?: string | null;
          last_successful_refresh_at?: string | null;
          mic?: string | null;
          name?: string;
          provider?: string;
          provider_instrument_id?: string;
          quote_currency?: string;
          symbol?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      market_prices: {
        Row: {
          created_at: string;
          currency: string;
          effective_date: string;
          id: string;
          instrument_id: string;
          is_current: boolean;
          price: number;
          price_kind: string;
          provider: string;
          provider_timestamp: string | null;
          received_at: string;
          superseded_by: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          effective_date: string;
          id?: string;
          instrument_id: string;
          is_current?: boolean;
          price: number;
          price_kind: string;
          provider: string;
          provider_timestamp?: string | null;
          received_at?: string;
          superseded_by?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          effective_date?: string;
          id?: string;
          instrument_id?: string;
          is_current?: boolean;
          price?: number;
          price_kind?: string;
          provider?: string;
          provider_timestamp?: string | null;
          received_at?: string;
          superseded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "market_prices_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_prices_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "market_prices";
            referencedColumns: ["id"];
          },
        ];
      };
      payees: {
        Row: {
          created_at: string;
          id: string;
          is_archived: boolean;
          name: string;
          normalized_name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_archived?: boolean;
          name: string;
          normalized_name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_archived?: boolean;
          name?: string;
          normalized_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      portfolio_value_snapshots: {
        Row: {
          cash_total: number | null;
          created_at: string;
          currency: string;
          external_cash_flow: number;
          id: string;
          invested_cost: number;
          liabilities_total: number | null;
          realized_gain: number;
          snapshot_date: string;
          unrealized_gain: number;
          user_id: string;
          valuation_coverage_percent: number;
          valued_total: number;
        };
        Insert: {
          cash_total?: number | null;
          created_at?: string;
          currency: string;
          external_cash_flow?: number;
          id?: string;
          invested_cost: number;
          liabilities_total?: number | null;
          realized_gain?: number;
          snapshot_date: string;
          unrealized_gain?: number;
          user_id: string;
          valuation_coverage_percent?: number;
          valued_total: number;
        };
        Update: {
          cash_total?: number | null;
          created_at?: string;
          currency?: string;
          external_cash_flow?: number;
          id?: string;
          invested_cost?: number;
          liabilities_total?: number | null;
          realized_gain?: number;
          snapshot_date?: string;
          unrealized_gain?: number;
          user_id?: string;
          valuation_coverage_percent?: number;
          valued_total?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          base_currency: string;
          created_at: string;
          display_name: string | null;
          financial_year_start_month: number;
          id: string;
          locale: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          base_currency?: string;
          created_at?: string;
          display_name?: string | null;
          financial_year_start_month?: number;
          id: string;
          locale?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          base_currency?: string;
          created_at?: string;
          display_name?: string | null;
          financial_year_start_month?: number;
          id?: string;
          locale?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_items: {
        Row: {
          amount: number;
          cancellation_date: string | null;
          category_id: string | null;
          created_at: string;
          currency: string;
          destination_account_id: string | null;
          end_date: string | null;
          frequency: string;
          id: string;
          interval_count: number;
          investment_holding_id: string | null;
          kind: string;
          name: string;
          next_due_date: string | null;
          notes: string | null;
          payee_id: string | null;
          processing_mode: string;
          source_account_id: string | null;
          start_date: string;
          status: string;
          trial_end_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          cancellation_date?: string | null;
          category_id?: string | null;
          created_at?: string;
          currency?: string;
          destination_account_id?: string | null;
          end_date?: string | null;
          frequency: string;
          id?: string;
          interval_count?: number;
          investment_holding_id?: string | null;
          kind: string;
          name: string;
          next_due_date?: string | null;
          notes?: string | null;
          payee_id?: string | null;
          processing_mode?: string;
          source_account_id?: string | null;
          start_date: string;
          status?: string;
          trial_end_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          cancellation_date?: string | null;
          category_id?: string | null;
          created_at?: string;
          currency?: string;
          destination_account_id?: string | null;
          end_date?: string | null;
          frequency?: string;
          id?: string;
          interval_count?: number;
          investment_holding_id?: string | null;
          kind?: string;
          name?: string;
          next_due_date?: string | null;
          notes?: string | null;
          payee_id?: string | null;
          processing_mode?: string;
          source_account_id?: string | null;
          start_date?: string;
          status?: string;
          trial_end_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_items_destination_account_id_fkey";
            columns: ["destination_account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "recurring_items_destination_account_id_fkey";
            columns: ["destination_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_items_investment_holding_id_fkey";
            columns: ["investment_holding_id"];
            isOneToOne: false;
            referencedRelation: "investment_holdings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_items_payee_id_fkey";
            columns: ["payee_id"];
            isOneToOne: false;
            referencedRelation: "payees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_items_source_account_id_fkey";
            columns: ["source_account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "recurring_items_source_account_id_fkey";
            columns: ["source_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_occurrences: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          linked_transaction_id: string | null;
          processed_at: string | null;
          recurring_item_id: string;
          scheduled_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency: string;
          failure_reason?: string | null;
          id?: string;
          linked_transaction_id?: string | null;
          processed_at?: string | null;
          recurring_item_id: string;
          scheduled_date: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          linked_transaction_id?: string | null;
          processed_at?: string | null;
          recurring_item_id?: string;
          scheduled_date?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_occurrences_linked_transaction_id_fkey";
            columns: ["linked_transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_occurrences_recurring_item_id_fkey";
            columns: ["recurring_item_id"];
            isOneToOne: false;
            referencedRelation: "recurring_items";
            referencedColumns: ["id"];
          },
        ];
      };
      research_notes: {
        Row: {
          body: string;
          created_at: string;
          filing_id: string | null;
          id: string;
          instrument_id: string;
          is_ai_reviewed_edited: boolean;
          is_archived: boolean;
          is_pinned: boolean;
          note_type: string;
          observed_date: string | null;
          source_ai_job_id: string | null;
          source_url: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          filing_id?: string | null;
          id?: string;
          instrument_id: string;
          is_ai_reviewed_edited?: boolean;
          is_archived?: boolean;
          is_pinned?: boolean;
          note_type?: string;
          observed_date?: string | null;
          source_ai_job_id?: string | null;
          source_url?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          filing_id?: string | null;
          id?: string;
          instrument_id?: string;
          is_ai_reviewed_edited?: boolean;
          is_archived?: boolean;
          is_pinned?: boolean;
          note_type?: string;
          observed_date?: string | null;
          source_ai_job_id?: string | null;
          source_url?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_notes_filing_id_fkey";
            columns: ["filing_id"];
            isOneToOne: false;
            referencedRelation: "company_filings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_notes_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_notes_source_ai_job_id_fkey";
            columns: ["source_ai_job_id"];
            isOneToOne: false;
            referencedRelation: "ai_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      research_review_events: {
        Row: {
          event_type: string;
          id: string;
          instrument_id: string | null;
          ipo_issue_id: string | null;
          occurred_at: string;
          related_id: string | null;
          related_table: string | null;
          summary: string | null;
          user_id: string;
        };
        Insert: {
          event_type: string;
          id?: string;
          instrument_id?: string | null;
          ipo_issue_id?: string | null;
          occurred_at?: string;
          related_id?: string | null;
          related_table?: string | null;
          summary?: string | null;
          user_id: string;
        };
        Update: {
          event_type?: string;
          id?: string;
          instrument_id?: string | null;
          ipo_issue_id?: string | null;
          occurred_at?: string;
          related_id?: string | null;
          related_table?: string | null;
          summary?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_review_events_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_review_events_ipo_issue_id_fkey";
            columns: ["ipo_issue_id"];
            isOneToOne: false;
            referencedRelation: "ipo_issues";
            referencedColumns: ["id"];
          },
        ];
      };
      research_sync_runs: {
        Row: {
          completed_at: string | null;
          error_code: string | null;
          id: string;
          items_requested: number;
          items_skipped: number;
          items_updated: number;
          scope: string;
          started_at: string;
          status: string;
          triggered_by_user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          error_code?: string | null;
          id?: string;
          items_requested?: number;
          items_skipped?: number;
          items_updated?: number;
          scope: string;
          started_at?: string;
          status?: string;
          triggered_by_user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          error_code?: string | null;
          id?: string;
          items_requested?: number;
          items_skipped?: number;
          items_updated?: number;
          scope?: string;
          started_at?: string;
          status?: string;
          triggered_by_user_id?: string | null;
        };
        Relationships: [];
      };
      source_document_chunks: {
        Row: {
          company_filing_id: string | null;
          content_hash: string;
          content_text: string;
          created_at: string;
          extraction_status: string;
          extractor_version: string;
          id: string;
          ipo_document_id: string | null;
          page_number: number | null;
          section_heading: string | null;
          user_id: string;
        };
        Insert: {
          company_filing_id?: string | null;
          content_hash: string;
          content_text: string;
          created_at?: string;
          extraction_status?: string;
          extractor_version?: string;
          id?: string;
          ipo_document_id?: string | null;
          page_number?: number | null;
          section_heading?: string | null;
          user_id: string;
        };
        Update: {
          company_filing_id?: string | null;
          content_hash?: string;
          content_text?: string;
          created_at?: string;
          extraction_status?: string;
          extractor_version?: string;
          id?: string;
          ipo_document_id?: string | null;
          page_number?: number | null;
          section_heading?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_document_chunks_company_filing_id_fkey";
            columns: ["company_filing_id"];
            isOneToOne: false;
            referencedRelation: "company_filings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_document_chunks_ipo_document_id_fkey";
            columns: ["ipo_document_id"];
            isOneToOne: false;
            referencedRelation: "ipo_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      statement_column_mappings: {
        Row: {
          amount_column: string | null;
          amount_sign_convention: string;
          balance_column: string | null;
          bank_label: string | null;
          created_at: string;
          credit_column: string | null;
          date_column: string;
          date_format: string;
          debit_column: string | null;
          description_column: string;
          header_fingerprint: string;
          id: string;
          reference_column: string | null;
          transaction_type_column: string | null;
          updated_at: string;
          user_id: string;
          value_date_column: string | null;
        };
        Insert: {
          amount_column?: string | null;
          amount_sign_convention?: string;
          balance_column?: string | null;
          bank_label?: string | null;
          created_at?: string;
          credit_column?: string | null;
          date_column: string;
          date_format: string;
          debit_column?: string | null;
          description_column: string;
          header_fingerprint: string;
          id?: string;
          reference_column?: string | null;
          transaction_type_column?: string | null;
          updated_at?: string;
          user_id: string;
          value_date_column?: string | null;
        };
        Update: {
          amount_column?: string | null;
          amount_sign_convention?: string;
          balance_column?: string | null;
          bank_label?: string | null;
          created_at?: string;
          credit_column?: string | null;
          date_column?: string;
          date_format?: string;
          debit_column?: string | null;
          description_column?: string;
          header_fingerprint?: string;
          id?: string;
          reference_column?: string | null;
          transaction_type_column?: string | null;
          updated_at?: string;
          user_id?: string;
          value_date_column?: string | null;
        };
        Relationships: [];
      };
      statement_import_row_matches: {
        Row: {
          candidate_row_id: string | null;
          candidate_transaction_id: string | null;
          confidence: string;
          conflicts: Json;
          created_at: string;
          id: string;
          import_row_id: string;
          match_kind: string;
          reasons: Json;
          score: number;
          user_id: string;
        };
        Insert: {
          candidate_row_id?: string | null;
          candidate_transaction_id?: string | null;
          confidence: string;
          conflicts?: Json;
          created_at?: string;
          id?: string;
          import_row_id: string;
          match_kind: string;
          reasons?: Json;
          score: number;
          user_id: string;
        };
        Update: {
          candidate_row_id?: string | null;
          candidate_transaction_id?: string | null;
          confidence?: string;
          conflicts?: Json;
          created_at?: string;
          id?: string;
          import_row_id?: string;
          match_kind?: string;
          reasons?: Json;
          score?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "statement_import_row_matches_candidate_row_id_fkey";
            columns: ["candidate_row_id"];
            isOneToOne: false;
            referencedRelation: "statement_import_rows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_row_matches_candidate_transaction_id_fkey";
            columns: ["candidate_transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_row_matches_import_row_id_fkey";
            columns: ["import_row_id"];
            isOneToOne: false;
            referencedRelation: "statement_import_rows";
            referencedColumns: ["id"];
          },
        ];
      };
      statement_import_rows: {
        Row: {
          account_id: string;
          amount: number | null;
          cheque_number: string | null;
          counterparty_account_id: string | null;
          created_at: string;
          currency: string;
          description: string;
          direction: string | null;
          duplicate_status: string;
          id: string;
          import_id: string;
          linked_created_transaction_id: string | null;
          linked_existing_transaction_id: string | null;
          match_status: string;
          matched_rule_id: string | null;
          notes: string | null;
          posting_result: string | null;
          reference: string | null;
          resolved_transaction_type: string | null;
          row_hash: string;
          row_index: number;
          running_balance: number | null;
          suggested_category_id: string | null;
          suggested_payee_id: string | null;
          suggested_transaction_type: string | null;
          transaction_date: string | null;
          transfer_group_id: string | null;
          updated_at: string;
          user_decision: string;
          user_id: string;
          validation_errors: Json;
          value_date: string | null;
        };
        Insert: {
          account_id: string;
          amount?: number | null;
          cheque_number?: string | null;
          counterparty_account_id?: string | null;
          created_at?: string;
          currency?: string;
          description?: string;
          direction?: string | null;
          duplicate_status?: string;
          id?: string;
          import_id: string;
          linked_created_transaction_id?: string | null;
          linked_existing_transaction_id?: string | null;
          match_status?: string;
          matched_rule_id?: string | null;
          notes?: string | null;
          posting_result?: string | null;
          reference?: string | null;
          resolved_transaction_type?: string | null;
          row_hash: string;
          row_index: number;
          running_balance?: number | null;
          suggested_category_id?: string | null;
          suggested_payee_id?: string | null;
          suggested_transaction_type?: string | null;
          transaction_date?: string | null;
          transfer_group_id?: string | null;
          updated_at?: string;
          user_decision?: string;
          user_id: string;
          validation_errors?: Json;
          value_date?: string | null;
        };
        Update: {
          account_id?: string;
          amount?: number | null;
          cheque_number?: string | null;
          counterparty_account_id?: string | null;
          created_at?: string;
          currency?: string;
          description?: string;
          direction?: string | null;
          duplicate_status?: string;
          id?: string;
          import_id?: string;
          linked_created_transaction_id?: string | null;
          linked_existing_transaction_id?: string | null;
          match_status?: string;
          matched_rule_id?: string | null;
          notes?: string | null;
          posting_result?: string | null;
          reference?: string | null;
          resolved_transaction_type?: string | null;
          row_hash?: string;
          row_index?: number;
          running_balance?: number | null;
          suggested_category_id?: string | null;
          suggested_payee_id?: string | null;
          suggested_transaction_type?: string | null;
          transaction_date?: string | null;
          transfer_group_id?: string | null;
          updated_at?: string;
          user_decision?: string;
          user_id?: string;
          validation_errors?: Json;
          value_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "statement_import_rows_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "statement_import_rows_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rows_counterparty_account_id_fkey";
            columns: ["counterparty_account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "statement_import_rows_counterparty_account_id_fkey";
            columns: ["counterparty_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rows_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "statement_imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rows_linked_created_transaction_id_fkey";
            columns: ["linked_created_transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rows_linked_existing_transaction_id_fkey";
            columns: ["linked_existing_transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rows_matched_rule_id_fkey";
            columns: ["matched_rule_id"];
            isOneToOne: false;
            referencedRelation: "statement_import_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rows_suggested_category_id_fkey";
            columns: ["suggested_category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rows_suggested_payee_id_fkey";
            columns: ["suggested_payee_id"];
            isOneToOne: false;
            referencedRelation: "payees";
            referencedColumns: ["id"];
          },
        ];
      };
      statement_import_rules: {
        Row: {
          account_id: string | null;
          created_at: string;
          direction_filter: string | null;
          exclude: boolean;
          id: string;
          is_active: boolean;
          match_field: string;
          match_value: string;
          max_amount: number | null;
          min_amount: number | null;
          name: string;
          notes_template: string | null;
          priority: number;
          suggested_category_id: string | null;
          suggested_payee_id: string | null;
          suggested_transaction_type: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          direction_filter?: string | null;
          exclude?: boolean;
          id?: string;
          is_active?: boolean;
          match_field: string;
          match_value: string;
          max_amount?: number | null;
          min_amount?: number | null;
          name: string;
          notes_template?: string | null;
          priority?: number;
          suggested_category_id?: string | null;
          suggested_payee_id?: string | null;
          suggested_transaction_type?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          direction_filter?: string | null;
          exclude?: boolean;
          id?: string;
          is_active?: boolean;
          match_field?: string;
          match_value?: string;
          max_amount?: number | null;
          min_amount?: number | null;
          name?: string;
          notes_template?: string | null;
          priority?: number;
          suggested_category_id?: string | null;
          suggested_payee_id?: string | null;
          suggested_transaction_type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "statement_import_rules_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "statement_import_rules_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rules_suggested_category_id_fkey";
            columns: ["suggested_category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_import_rules_suggested_payee_id_fkey";
            columns: ["suggested_payee_id"];
            isOneToOne: false;
            referencedRelation: "payees";
            referencedColumns: ["id"];
          },
        ];
      };
      statement_imports: {
        Row: {
          account_id: string;
          amount_column: string | null;
          amount_sign_convention: string | null;
          balance_column: string | null;
          closing_balance: number | null;
          column_mapping_id: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          credit_column: string | null;
          currency: string;
          date_column: string | null;
          date_format: string | null;
          debit_column: string | null;
          description_column: string | null;
          detected_delimiter: string;
          detected_encoding: string;
          discarded_at: string | null;
          duplicate_rows: number;
          error_code: string | null;
          excluded_rows: number;
          expected_closing_balance: number | null;
          file_format: string;
          file_hash: string;
          file_size_bytes: number;
          header_fingerprint: string;
          id: string;
          imported_rows: number;
          invalid_rows: number;
          mapped_at: string | null;
          matched_rows: number;
          opening_balance: number | null;
          original_filename: string;
          parsed_at: string | null;
          reconciliation_status: string;
          reference_column: string | null;
          row_count_hint: number | null;
          statement_end_date: string | null;
          statement_start_date: string | null;
          status: string;
          total_rows: number;
          transaction_type_column: string | null;
          updated_at: string;
          user_id: string;
          valid_rows: number;
          value_date_column: string | null;
        };
        Insert: {
          account_id: string;
          amount_column?: string | null;
          amount_sign_convention?: string | null;
          balance_column?: string | null;
          closing_balance?: number | null;
          column_mapping_id?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          credit_column?: string | null;
          currency?: string;
          date_column?: string | null;
          date_format?: string | null;
          debit_column?: string | null;
          description_column?: string | null;
          detected_delimiter: string;
          detected_encoding?: string;
          discarded_at?: string | null;
          duplicate_rows?: number;
          error_code?: string | null;
          excluded_rows?: number;
          expected_closing_balance?: number | null;
          file_format: string;
          file_hash: string;
          file_size_bytes: number;
          header_fingerprint: string;
          id?: string;
          imported_rows?: number;
          invalid_rows?: number;
          mapped_at?: string | null;
          matched_rows?: number;
          opening_balance?: number | null;
          original_filename: string;
          parsed_at?: string | null;
          reconciliation_status?: string;
          reference_column?: string | null;
          row_count_hint?: number | null;
          statement_end_date?: string | null;
          statement_start_date?: string | null;
          status?: string;
          total_rows?: number;
          transaction_type_column?: string | null;
          updated_at?: string;
          user_id: string;
          valid_rows?: number;
          value_date_column?: string | null;
        };
        Update: {
          account_id?: string;
          amount_column?: string | null;
          amount_sign_convention?: string | null;
          balance_column?: string | null;
          closing_balance?: number | null;
          column_mapping_id?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          credit_column?: string | null;
          currency?: string;
          date_column?: string | null;
          date_format?: string | null;
          debit_column?: string | null;
          description_column?: string | null;
          detected_delimiter?: string;
          detected_encoding?: string;
          discarded_at?: string | null;
          duplicate_rows?: number;
          error_code?: string | null;
          excluded_rows?: number;
          expected_closing_balance?: number | null;
          file_format?: string;
          file_hash?: string;
          file_size_bytes?: number;
          header_fingerprint?: string;
          id?: string;
          imported_rows?: number;
          invalid_rows?: number;
          mapped_at?: string | null;
          matched_rows?: number;
          opening_balance?: number | null;
          original_filename?: string;
          parsed_at?: string | null;
          reconciliation_status?: string;
          reference_column?: string | null;
          row_count_hint?: number | null;
          statement_end_date?: string | null;
          statement_start_date?: string | null;
          status?: string;
          total_rows?: number;
          transaction_type_column?: string | null;
          updated_at?: string;
          user_id?: string;
          valid_rows?: number;
          value_date_column?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "statement_imports_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "statement_imports_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_imports_column_mapping_id_fkey";
            columns: ["column_mapping_id"];
            isOneToOne: false;
            referencedRelation: "statement_column_mappings";
            referencedColumns: ["id"];
          },
        ];
      };
      watchlist_items: {
        Row: {
          added_at: string;
          created_at: string;
          id: string;
          instrument_id: string;
          priority: string;
          research_status: string;
          sort_order: number;
          target_review_date: string | null;
          updated_at: string;
          user_id: string;
          watchlist_id: string;
        };
        Insert: {
          added_at?: string;
          created_at?: string;
          id?: string;
          instrument_id: string;
          priority?: string;
          research_status?: string;
          sort_order?: number;
          target_review_date?: string | null;
          updated_at?: string;
          user_id: string;
          watchlist_id: string;
        };
        Update: {
          added_at?: string;
          created_at?: string;
          id?: string;
          instrument_id?: string;
          priority?: string;
          research_status?: string;
          sort_order?: number;
          target_review_date?: string | null;
          updated_at?: string;
          user_id?: string;
          watchlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watchlist_items_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "market_instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey";
            columns: ["watchlist_id"];
            isOneToOne: false;
            referencedRelation: "watchlists";
            referencedColumns: ["id"];
          },
        ];
      };
      watchlists: {
        Row: {
          color: string;
          created_at: string;
          description: string | null;
          icon: string;
          id: string;
          name: string;
          sort_order: number;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          name: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      account_balances: {
        Row: {
          account_class: string | null;
          account_id: string | null;
          account_type: string | null;
          currency: string | null;
          display_balance: number | null;
          name: string | null;
          signed_balance: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_ai_job_output: {
        Args: { p_edited_content?: string; p_output_id: string };
        Returns: {
          accepted: boolean;
          accepted_at: string | null;
          citations: Json;
          content: string;
          created_at: string;
          display_order: number;
          id: string;
          is_user_edited: boolean;
          job_id: string;
          saved_as_id: string | null;
          saved_as_table: string | null;
          section_type: string;
        };
        SetofOptions: {
          from: "*";
          to: "ai_job_outputs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      add_investment_valuation: {
        Args: {
          p_holding_id: string;
          p_note?: string;
          p_total_value: number;
          p_unit_value?: number;
          p_valued_at: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          holding_id: string;
          id: string;
          note: string | null;
          source: string;
          total_value: number;
          unit_value: number | null;
          user_id: string;
          valued_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_valuations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      add_ipo_document: {
        Args: {
          p_document_type: string;
          p_filing_date?: string;
          p_ipo_issue_id: string;
          p_source_organization: string;
          p_source_page_url?: string;
          p_source_url: string;
          p_supersedes_document_id?: string;
          p_title: string;
        };
        Returns: {
          added_by_user_id: string;
          content_hash: string | null;
          created_at: string;
          document_type: string;
          filing_date: string | null;
          id: string;
          ipo_issue_id: string;
          is_verified: boolean;
          retrieved_at: string | null;
          source_organization: string;
          source_page_url: string | null;
          source_url: string;
          supersedes_document_id: string | null;
          title: string;
        };
        SetofOptions: {
          from: "*";
          to: "ipo_documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      add_ipo_financial_metric: {
        Args: {
          p_currency?: string;
          p_fiscal_period_end: string;
          p_ipo_issue_id: string;
          p_metric_key: string;
          p_source_citation?: string;
          p_source_document_id?: string;
          p_statement_basis?: string;
          p_unit_scale?: string;
          p_value: number;
        };
        Returns: {
          added_by_user_id: string;
          created_at: string;
          currency: string;
          extraction_method: string;
          fiscal_period_end: string;
          human_verified: boolean;
          id: string;
          ipo_issue_id: string;
          is_current: boolean;
          metric_key: string;
          source_citation: string | null;
          source_document_id: string | null;
          statement_basis: string;
          superseded_by: string | null;
          unit_scale: string;
          value: number;
        };
        SetofOptions: {
          from: "*";
          to: "ipo_financial_metrics";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      add_ipo_from_official_source: {
        Args: {
          p_board: string;
          p_cin?: string;
          p_exchange?: string;
          p_industry?: string;
          p_isin?: string;
          p_issue_type?: string;
          p_issuer_name: string;
          p_source_organization: string;
          p_source_url: string;
          p_status?: string;
        };
        Returns: {
          added_by_user_id: string;
          anchor_date: string | null;
          basis_of_allotment_date: string | null;
          board: string;
          cin: string | null;
          created_at: string;
          demat_credit_date: string | null;
          exchange: string | null;
          face_value: number | null;
          final_issue_price: number | null;
          fresh_issue_amount: number | null;
          id: string;
          industry: string | null;
          isin: string | null;
          issue_close_date: string | null;
          issue_open_date: string | null;
          issue_type: string;
          issuer_name: string;
          last_verified_at: string;
          linked_confirmed_at: string | null;
          linked_instrument_id: string | null;
          listing_date: string | null;
          lot_size: number | null;
          min_application_quantity: number | null;
          offer_for_sale_amount: number | null;
          price_band_max: number | null;
          price_band_min: number | null;
          refund_date: string | null;
          source_organization: string;
          source_url: string;
          status: string;
          total_issue_size: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "ipo_issues";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      apply_statement_import_mapping: {
        Args: {
          p_amount_column?: string;
          p_amount_sign_convention?: string;
          p_balance_column?: string;
          p_column_mapping_id?: string;
          p_credit_column?: string;
          p_date_column: string;
          p_date_format: string;
          p_debit_column?: string;
          p_description_column: string;
          p_import_id: string;
          p_reference_column?: string;
          p_transaction_type_column?: string;
          p_value_date_column?: string;
        };
        Returns: {
          account_id: string;
          amount_column: string | null;
          amount_sign_convention: string | null;
          balance_column: string | null;
          closing_balance: number | null;
          column_mapping_id: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          credit_column: string | null;
          currency: string;
          date_column: string | null;
          date_format: string | null;
          debit_column: string | null;
          description_column: string | null;
          detected_delimiter: string;
          detected_encoding: string;
          discarded_at: string | null;
          duplicate_rows: number;
          error_code: string | null;
          excluded_rows: number;
          expected_closing_balance: number | null;
          file_format: string;
          file_hash: string;
          file_size_bytes: number;
          header_fingerprint: string;
          id: string;
          imported_rows: number;
          invalid_rows: number;
          mapped_at: string | null;
          matched_rows: number;
          opening_balance: number | null;
          original_filename: string;
          parsed_at: string | null;
          reconciliation_status: string;
          reference_column: string | null;
          row_count_hint: number | null;
          statement_end_date: string | null;
          statement_start_date: string | null;
          status: string;
          total_rows: number;
          transaction_type_column: string | null;
          updated_at: string;
          user_id: string;
          valid_rows: number;
          value_date_column: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_imports";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      apply_statement_import_row_analysis: {
        Args: { p_import_id: string; p_matches?: Json; p_row_updates: Json };
        Returns: {
          account_id: string;
          amount_column: string | null;
          amount_sign_convention: string | null;
          balance_column: string | null;
          closing_balance: number | null;
          column_mapping_id: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          credit_column: string | null;
          currency: string;
          date_column: string | null;
          date_format: string | null;
          debit_column: string | null;
          description_column: string | null;
          detected_delimiter: string;
          detected_encoding: string;
          discarded_at: string | null;
          duplicate_rows: number;
          error_code: string | null;
          excluded_rows: number;
          expected_closing_balance: number | null;
          file_format: string;
          file_hash: string;
          file_size_bytes: number;
          header_fingerprint: string;
          id: string;
          imported_rows: number;
          invalid_rows: number;
          mapped_at: string | null;
          matched_rows: number;
          opening_balance: number | null;
          original_filename: string;
          parsed_at: string | null;
          reconciliation_status: string;
          reference_column: string | null;
          row_count_hint: number | null;
          statement_end_date: string | null;
          statement_start_date: string | null;
          status: string;
          total_rows: number;
          transaction_type_column: string | null;
          updated_at: string;
          user_id: string;
          valid_rows: number;
          value_date_column: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_imports";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      asset_allocation_by_asset: {
        Args: never;
        Returns: {
          asset_kind: string;
          currency: string;
          current_value: number;
          display_name: string;
          investment_asset_id: string;
          percent_of_portfolio: number;
        }[];
      };
      asset_allocation_by_kind: {
        Args: never;
        Returns: {
          asset_kind: string;
          currency: string;
          current_value: number;
          percent_of_portfolio: number;
        }[];
      };
      attempt_post_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: boolean;
      };
      block_ai_job: {
        Args: { p_error_code: string; p_job_id: string };
        Returns: undefined;
      };
      budget_category_progress: {
        Args: { p_currency?: string; p_period_month: string };
        Returns: {
          actual_amount: number;
          category_color: string;
          category_icon: string;
          category_id: string;
          category_name: string;
          planned_amount: number;
          progress_status: string;
          remaining_amount: number;
          usage_percent: number;
        }[];
      };
      budget_summary: {
        Args: { p_currency?: string; p_period_month: string };
        Returns: {
          actual_expense: number;
          actual_income: number;
          actual_net_cash_flow: number;
          overspent: number;
          planned_expense: number;
          planned_income: number;
          planned_surplus: number;
          remaining: number;
          unbudgeted_expense_total: number;
        }[];
      };
      budget_unbudgeted_expenses: {
        Args: { p_currency?: string; p_period_month: string };
        Returns: {
          actual_amount: number;
          category_color: string;
          category_icon: string;
          category_id: string;
          category_name: string;
        }[];
      };
      build_portfolio_snapshot: {
        Args: { p_snapshot_date?: string; p_user_id: string };
        Returns: {
          cash_total: number | null;
          created_at: string;
          currency: string;
          external_cash_flow: number;
          id: string;
          invested_cost: number;
          liabilities_total: number | null;
          realized_gain: number;
          snapshot_date: string;
          unrealized_gain: number;
          user_id: string;
          valuation_coverage_percent: number;
          valued_total: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "portfolio_value_snapshots";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      bulk_update_statement_import_rows: {
        Args: {
          p_category_id?: string;
          p_import_id: string;
          p_payee_id?: string;
          p_row_ids: string[];
          p_user_decision?: string;
        };
        Returns: {
          updated_count: number;
        }[];
      };
      complete_ai_job: {
        Args: {
          p_duration_ms: number;
          p_estimated_cost_usd: number;
          p_input_tokens: number;
          p_job_id: string;
          p_output_hash: string;
          p_output_tokens: number;
          p_outputs: Json;
        };
        Returns: undefined;
      };
      confirm_statement_transfer_match: {
        Args: { p_candidate_row_id: string; p_row_id: string };
        Returns: undefined;
      };
      copy_budget_period: {
        Args: {
          p_currency?: string;
          p_source_period_month: string;
          p_target_period_month: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          notes: string | null;
          period_month: string;
          planned_income: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "budget_periods";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_account_with_opening_balance:
        | {
            Args: {
              p_account_type: string;
              p_credit_limit?: number;
              p_currency?: string;
              p_institution_id?: string;
              p_last_four?: string;
              p_name: string;
              p_notes?: string;
              p_opened_on?: string;
              p_opening_balance?: number;
              p_opening_balance_at?: string;
            };
            Returns: {
              account_class: string;
              account_type: string;
              closed_on: string | null;
              created_at: string;
              credit_limit: number | null;
              currency: string;
              id: string;
              institution_id: string | null;
              is_archived: boolean;
              is_system: boolean;
              last_four: string | null;
              name: string;
              notes: string | null;
              opened_on: string | null;
              system_code: string | null;
              updated_at: string;
              user_id: string;
            };
            SetofOptions: {
              from: "*";
              to: "accounts";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              p_account_type: string;
              p_credit_limit?: string;
              p_currency?: string;
              p_institution_id?: string;
              p_last_four?: string;
              p_name: string;
              p_notes?: string;
              p_opened_on?: string;
              p_opening_balance?: string;
              p_opening_balance_at?: string;
            };
            Returns: {
              account_class: string;
              account_type: string;
              closed_on: string | null;
              created_at: string;
              credit_limit: number | null;
              currency: string;
              id: string;
              institution_id: string | null;
              is_archived: boolean;
              is_system: boolean;
              last_four: string | null;
              name: string;
              notes: string | null;
              opened_on: string | null;
              system_code: string | null;
              updated_at: string;
              user_id: string;
            };
            SetofOptions: {
              from: "*";
              to: "accounts";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      create_ai_job: {
        Args: {
          p_chunk_ids?: string[];
          p_input_hash: string;
          p_job_kind: string;
          p_model_id: string;
          p_prompt_template_version: string;
          p_provider: string;
          p_question_text?: string;
          p_scope_compare_instrument_ids?: string[];
          p_scope_instrument_id?: string;
          p_scope_ipo_issue_id?: string;
          p_scope_type: string;
        };
        Returns: {
          job_id: string;
          queued: boolean;
          reason: string;
        }[];
      };
      create_fixed_deposit: {
        Args: {
          p_compounding_frequency?: string;
          p_display_name: string;
          p_expected_maturity_amount?: number;
          p_funding_account_id: string;
          p_idempotency_key: string;
          p_interest_payout_mode?: string;
          p_interest_rate?: number;
          p_investment_account_id: string;
          p_maturity_date: string;
          p_notes?: string;
          p_principal_amount: number;
          p_provider?: string;
          p_start_date: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          investment_account_id: string | null;
          investment_asset_id: string;
          opened_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_holdings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_investment_asset: {
        Args: {
          p_asset_kind: string;
          p_currency?: string;
          p_display_name: string;
          p_exchange?: string;
          p_isin?: string;
          p_notes?: string;
          p_scheme_code?: string;
          p_symbol?: string;
          p_unit_precision?: number;
        };
        Returns: {
          asset_kind: string;
          created_at: string;
          currency: string;
          display_name: string;
          exchange: string | null;
          id: string;
          investment_account_id: string | null;
          isin: string | null;
          market_instrument_id: string | null;
          market_link_confirmed_at: string | null;
          notes: string | null;
          scheme_code: string | null;
          status: string;
          symbol: string | null;
          unit_precision: number;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_assets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_investment_holding: {
        Args: {
          p_currency?: string;
          p_investment_account_id?: string;
          p_investment_asset_id: string;
          p_opened_date?: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          investment_account_id: string | null;
          investment_asset_id: string;
          opened_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_holdings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_manual_transaction: {
        Args: {
          p_category_id?: string;
          p_description: string;
          p_entries: Json;
          p_idempotency_key?: string;
          p_notes?: string;
          p_occurred_at: string;
          p_payee_id?: string;
          p_transaction_type: string;
        };
        Returns: {
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
          payee_id: string | null;
          replaces_transaction_id: string | null;
          reversal_of: string | null;
          reversed_by: string | null;
          source_reference: string | null;
          source_type: string;
          status: string;
          transaction_type: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "ledger_transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_ppf_account: {
        Args: {
          p_display_name: string;
          p_interest_rate?: number;
          p_investment_account_id: string;
          p_maturity_date?: string;
          p_notes?: string;
          p_opening_contribution_amount?: number;
          p_opening_contribution_funding_account_id?: string;
          p_opening_contribution_idempotency_key?: string;
          p_provider?: string;
          p_start_date: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          investment_account_id: string | null;
          investment_asset_id: string;
          opened_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_holdings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_recurring_deposit: {
        Args: {
          p_display_name: string;
          p_expected_maturity_amount?: number;
          p_frequency: string;
          p_funding_account_id: string;
          p_installment_amount: number;
          p_interest_rate?: number;
          p_interval_count?: number;
          p_investment_account_id: string;
          p_maturity_date: string;
          p_notes?: string;
          p_planned_installments?: number;
          p_processing_mode?: string;
          p_provider?: string;
          p_start_date: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          investment_account_id: string | null;
          investment_asset_id: string;
          opened_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_holdings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_recurring_item: {
        Args: {
          p_amount: number;
          p_cancellation_date?: string;
          p_category_id?: string;
          p_currency: string;
          p_destination_account_id?: string;
          p_end_date?: string;
          p_frequency: string;
          p_interval_count: number;
          p_kind: string;
          p_name: string;
          p_notes?: string;
          p_payee_id?: string;
          p_processing_mode: string;
          p_source_account_id?: string;
          p_start_date: string;
          p_trial_end_date?: string;
        };
        Returns: {
          amount: number;
          cancellation_date: string | null;
          category_id: string | null;
          created_at: string;
          currency: string;
          destination_account_id: string | null;
          end_date: string | null;
          frequency: string;
          id: string;
          interval_count: number;
          investment_holding_id: string | null;
          kind: string;
          name: string;
          next_due_date: string | null;
          notes: string | null;
          payee_id: string | null;
          processing_mode: string;
          source_account_id: string | null;
          start_date: string;
          status: string;
          trial_end_date: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "recurring_items";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_statement_import: {
        Args: {
          p_account_id: string;
          p_currency?: string;
          p_detected_delimiter: string;
          p_detected_encoding: string;
          p_file_format: string;
          p_file_hash: string;
          p_file_size_bytes: number;
          p_header_fingerprint: string;
          p_original_filename: string;
          p_row_count_hint?: number;
        };
        Returns: {
          existing_import_id: string;
          import_id: string;
          is_duplicate_file: boolean;
        }[];
      };
      dashboard_cash_flow_trend: {
        Args: { p_end: string; p_start: string };
        Returns: {
          period_month: string;
          total_expense: number;
          total_income: number;
        }[];
      };
      dashboard_expense_by_category: {
        Args: { p_end: string; p_start: string };
        Returns: {
          category_color: string;
          category_icon: string;
          category_id: string;
          category_name: string;
          total_amount: number;
        }[];
      };
      dashboard_summary: {
        Args: { p_end: string; p_start: string };
        Returns: {
          net_cash_flow: number;
          total_expense: number;
          total_income: number;
        }[];
      };
      delete_statement_import_rule: {
        Args: { p_rule_id: string };
        Returns: undefined;
      };
      discard_statement_import: {
        Args: { p_import_id: string };
        Returns: {
          account_id: string;
          amount_column: string | null;
          amount_sign_convention: string | null;
          balance_column: string | null;
          closing_balance: number | null;
          column_mapping_id: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          credit_column: string | null;
          currency: string;
          date_column: string | null;
          date_format: string | null;
          debit_column: string | null;
          description_column: string | null;
          detected_delimiter: string;
          detected_encoding: string;
          discarded_at: string | null;
          duplicate_rows: number;
          error_code: string | null;
          excluded_rows: number;
          expected_closing_balance: number | null;
          file_format: string;
          file_hash: string;
          file_size_bytes: number;
          header_fingerprint: string;
          id: string;
          imported_rows: number;
          invalid_rows: number;
          mapped_at: string | null;
          matched_rows: number;
          opening_balance: number | null;
          original_filename: string;
          parsed_at: string | null;
          reconciliation_status: string;
          reference_column: string | null;
          row_count_hint: number | null;
          statement_end_date: string | null;
          statement_start_date: string | null;
          status: string;
          total_rows: number;
          transaction_type_column: string | null;
          updated_at: string;
          user_id: string;
          valid_rows: number;
          value_date_column: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_imports";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      edit_manual_transaction: {
        Args: {
          p_category_id?: string;
          p_description: string;
          p_entries: Json;
          p_notes?: string;
          p_occurred_at: string;
          p_payee_id?: string;
          p_reason?: string;
          p_transaction_id: string;
        };
        Returns: {
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
          payee_id: string | null;
          replaces_transaction_id: string | null;
          reversal_of: string | null;
          reversed_by: string | null;
          source_reference: string | null;
          source_type: string;
          status: string;
          transaction_type: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "ledger_transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ensure_company_financial_period: {
        Args: {
          p_currency: string;
          p_fiscal_period_end: string;
          p_fiscal_quarter: number;
          p_fiscal_year: number;
          p_instrument_id: string;
          p_period_type: string;
          p_provider: string;
          p_report_date: string;
          p_statement_basis: string;
        };
        Returns: string;
      };
      fail_ai_job: {
        Args: { p_error_code: string; p_job_id: string };
        Returns: undefined;
      };
      generate_occurrences_for_item: {
        Args: {
          p_horizon_end: string;
          p_item: Database["public"]["Tables"]["recurring_items"]["Row"];
        };
        Returns: undefined;
      };
      generate_recurring_occurrences: {
        Args: { p_horizon_days?: number; p_user_id?: string };
        Returns: number;
      };
      get_or_create_budget_period: {
        Args: { p_currency?: string; p_period_month: string };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          notes: string | null;
          period_month: string;
          planned_income: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "budget_periods";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ingest_company_financial_metric: {
        Args: {
          p_metric_key: string;
          p_period_id: string;
          p_provider?: string;
          p_statement_type: string;
          p_unit_scale?: string;
          p_value: number;
        };
        Returns: {
          created_at: string;
          id: string;
          is_current: boolean;
          metric_key: string;
          period_id: string;
          provider: string;
          received_at: string;
          statement_type: string;
          superseded_by: string | null;
          unit_scale: string;
          value: number;
        };
        SetofOptions: {
          from: "*";
          to: "company_financial_metrics";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ingest_company_financial_metrics_batch: {
        Args: { p_rows: Json };
        Returns: {
          skipped_count: number;
          updated_count: number;
        }[];
      };
      ingest_company_profile: {
        Args: {
          p_country?: string;
          p_description?: string;
          p_fiscal_year_end?: string;
          p_industry?: string;
          p_instrument_id: string;
          p_legal_name?: string;
          p_provider: string;
          p_sector?: string;
          p_website?: string;
        };
        Returns: {
          country: string | null;
          created_at: string;
          description: string | null;
          fiscal_year_end: string | null;
          industry: string | null;
          instrument_id: string;
          legal_name: string | null;
          provider: string;
          received_at: string;
          sector: string | null;
          updated_at: string;
          website: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "company_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ingest_corporate_event: {
        Args: {
          p_announcement_at?: string;
          p_details?: Json;
          p_effective_date?: string;
          p_event_type: string;
          p_ex_date?: string;
          p_instrument_id: string;
          p_meeting_or_result_date?: string;
          p_official_url?: string;
          p_payment_date?: string;
          p_provider_event_id?: string;
          p_record_date?: string;
          p_source: string;
          p_status?: string;
          p_title: string;
        };
        Returns: {
          announcement_at: string | null;
          created_at: string;
          details: Json;
          effective_date: string | null;
          event_type: string;
          ex_date: string | null;
          id: string;
          instrument_id: string;
          is_current: boolean;
          meeting_or_result_date: string | null;
          official_url: string | null;
          payment_date: string | null;
          provider_event_id: string | null;
          received_at: string;
          record_date: string | null;
          source: string;
          status: string;
          superseded_by: string | null;
          title: string;
        };
        SetofOptions: {
          from: "*";
          to: "corporate_events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ingest_market_price_observation: {
        Args: {
          p_currency?: string;
          p_effective_date: string;
          p_instrument_id: string;
          p_price: number;
          p_price_kind: string;
          p_provider: string;
          p_provider_timestamp?: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          effective_date: string;
          id: string;
          instrument_id: string;
          is_current: boolean;
          price: number;
          price_kind: string;
          provider: string;
          provider_timestamp: string | null;
          received_at: string;
          superseded_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "market_prices";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ingest_market_price_observations_batch: {
        Args: {
          p_currency: string;
          p_price_kind: string;
          p_provider: string;
          p_rows: Json;
        };
        Returns: {
          skipped_count: number;
          updated_count: number;
        }[];
      };
      insert_statement_import_rows: {
        Args: { p_import_id: string; p_rows: Json };
        Returns: {
          inserted_count: number;
        }[];
      };
      investment_holding_position: {
        Args: { p_holding_id: string };
        Returns: {
          cost_basis: number;
          quantity: number;
        }[];
      };
      investment_holding_summary: {
        Args: never;
        Returns: {
          asset_kind: string;
          avg_unit_cost: number;
          cost_basis: number;
          currency: string;
          current_value: number;
          display_name: string;
          has_valuation: boolean;
          holding_id: string;
          income_received: number;
          investment_asset_id: string;
          last_refreshed_at: string;
          price_effective_date: string;
          price_status: string;
          quantity: number;
          realized_gain: number;
          status: string;
          symbol: string;
          unrealized_gain: number;
          valuation_source: string;
        }[];
      };
      invoke_market_data_function: {
        Args: { p_body?: Json; p_function_name: string };
        Returns: number;
      };
      ist_month_bounds: {
        Args: { p_period_month: string };
        Returns: {
          period_end: string;
          period_start: string;
        }[];
      };
      link_existing_transaction_to_occurrence: {
        Args: { p_occurrence_id: string; p_transaction_id: string };
        Returns: {
          amount: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          linked_transaction_id: string | null;
          processed_at: string | null;
          recurring_item_id: string;
          scheduled_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "recurring_occurrences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      link_investment_asset_to_market_instrument: {
        Args: {
          p_asset_id: string;
          p_confirm_remap?: boolean;
          p_market_instrument_id: string;
        };
        Returns: {
          asset_kind: string;
          created_at: string;
          currency: string;
          display_name: string;
          exchange: string | null;
          id: string;
          investment_account_id: string | null;
          isin: string | null;
          market_instrument_id: string | null;
          market_link_confirmed_at: string | null;
          notes: string | null;
          scheme_code: string | null;
          status: string;
          symbol: string | null;
          unit_precision: number;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_assets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      link_ipo_to_market_instrument: {
        Args: { p_instrument_id: string; p_ipo_issue_id: string };
        Returns: {
          added_by_user_id: string;
          anchor_date: string | null;
          basis_of_allotment_date: string | null;
          board: string;
          cin: string | null;
          created_at: string;
          demat_credit_date: string | null;
          exchange: string | null;
          face_value: number | null;
          final_issue_price: number | null;
          fresh_issue_amount: number | null;
          id: string;
          industry: string | null;
          isin: string | null;
          issue_close_date: string | null;
          issue_open_date: string | null;
          issue_type: string;
          issuer_name: string;
          last_verified_at: string;
          linked_confirmed_at: string | null;
          linked_instrument_id: string | null;
          listing_date: string | null;
          lot_size: number | null;
          min_application_quantity: number | null;
          offer_for_sale_amount: number | null;
          price_band_max: number | null;
          price_band_min: number | null;
          refund_date: string | null;
          source_organization: string;
          source_url: string;
          status: string;
          total_issue_size: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "ipo_issues";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      link_statement_import_row_to_transaction: {
        Args: { p_row_id: string; p_transaction_id: string };
        Returns: {
          account_id: string;
          amount: number | null;
          cheque_number: string | null;
          counterparty_account_id: string | null;
          created_at: string;
          currency: string;
          description: string;
          direction: string | null;
          duplicate_status: string;
          id: string;
          import_id: string;
          linked_created_transaction_id: string | null;
          linked_existing_transaction_id: string | null;
          match_status: string;
          matched_rule_id: string | null;
          notes: string | null;
          posting_result: string | null;
          reference: string | null;
          resolved_transaction_type: string | null;
          row_hash: string;
          row_index: number;
          running_balance: number | null;
          suggested_category_id: string | null;
          suggested_payee_id: string | null;
          suggested_transaction_type: string | null;
          transaction_date: string | null;
          transfer_group_id: string | null;
          updated_at: string;
          user_decision: string;
          user_id: string;
          validation_errors: Json;
          value_date: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_import_rows";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_overdue_theses_needs_review: { Args: never; Returns: number };
      mark_statement_import_ready: {
        Args: { p_import_id: string };
        Returns: {
          account_id: string;
          amount_column: string | null;
          amount_sign_convention: string | null;
          balance_column: string | null;
          closing_balance: number | null;
          column_mapping_id: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          credit_column: string | null;
          currency: string;
          date_column: string | null;
          date_format: string | null;
          debit_column: string | null;
          description_column: string | null;
          detected_delimiter: string;
          detected_encoding: string;
          discarded_at: string | null;
          duplicate_rows: number;
          error_code: string | null;
          excluded_rows: number;
          expected_closing_balance: number | null;
          file_format: string;
          file_hash: string;
          file_size_bytes: number;
          header_fingerprint: string;
          id: string;
          imported_rows: number;
          invalid_rows: number;
          mapped_at: string | null;
          matched_rows: number;
          opening_balance: number | null;
          original_filename: string;
          parsed_at: string | null;
          reconciliation_status: string;
          reference_column: string | null;
          row_count_hint: number | null;
          statement_end_date: string | null;
          statement_start_date: string | null;
          status: string;
          total_rows: number;
          transaction_type_column: string | null;
          updated_at: string;
          user_id: string;
          valid_rows: number;
          value_date_column: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_imports";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      market_price_status: {
        Args: { p_effective_date: string };
        Returns: string;
      };
      mature_fixed_deposit: {
        Args: {
          p_actual_maturity_amount: number;
          p_holding_id: string;
          p_idempotency_key: string;
          p_maturity_date: string;
          p_notes?: string;
          p_receiving_account_id: string;
        };
        Returns: {
          actual_maturity_amount: number | null;
          compounding_frequency: string | null;
          created_at: string;
          expected_maturity_amount: number | null;
          holding_id: string;
          id: string;
          installment_amount: number | null;
          interest_payout_mode: string | null;
          interest_rate: number | null;
          kind: string;
          maturity_date: string | null;
          notes: string | null;
          planned_installments: number | null;
          principal_amount: number | null;
          provider: string | null;
          recurring_item_id: string | null;
          start_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "fixed_income_details";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      net_worth_summary: {
        Args: never;
        Returns: {
          cash_and_bank: number;
          credit_card_outstanding: number;
          currency: string;
          fd_value: number;
          investment_value: number;
          net_worth: number;
          other_liabilities: number;
          ppf_balance: number;
          rd_balance: number;
          total_assets: number;
          total_liabilities: number;
        }[];
      };
      portfolio_summary: {
        Args: never;
        Returns: {
          active_holdings_count: number;
          currency: string;
          missing_valuation_count: number;
          total_current_value: number;
          total_income_received: number;
          total_invested_cost: number;
          total_realized_gain: number;
          total_unrealized_gain: number;
        }[];
      };
      post_manual_transaction_for_user: {
        Args: {
          p_category_id?: string;
          p_description: string;
          p_entries: Json;
          p_idempotency_key?: string;
          p_notes?: string;
          p_occurred_at: string;
          p_payee_id?: string;
          p_source_type?: string;
          p_transaction_type: string;
          p_user_id: string;
        };
        Returns: {
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
          payee_id: string | null;
          replaces_transaction_id: string | null;
          reversal_of: string | null;
          reversed_by: string | null;
          source_reference: string | null;
          source_type: string;
          status: string;
          transaction_type: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "ledger_transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      post_occurrence_payment: {
        Args: {
          p_category_id?: string;
          p_description: string;
          p_entries: Json;
          p_notes?: string;
          p_occurred_at: string;
          p_occurrence_id: string;
          p_payee_id?: string;
          p_transaction_type: string;
        };
        Returns: {
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
          payee_id: string | null;
          replaces_transaction_id: string | null;
          reversal_of: string | null;
          reversed_by: string | null;
          source_reference: string | null;
          source_type: string;
          status: string;
          transaction_type: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "ledger_transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      post_statement_import_batch: {
        Args: { p_import_id: string };
        Returns: {
          error_code: string;
          linked_count: number;
          posted_count: number;
          success: boolean;
          transfer_count: number;
        }[];
      };
      ppf_financial_year_summary: {
        Args: { p_financial_year_start_date: string };
        Returns: {
          display_name: string;
          financial_year_end: string;
          financial_year_start: string;
          holding_id: string;
          total_contributions: number;
        }[];
      };
      process_company_fundamentals_refresh_all: {
        Args: never;
        Returns: undefined;
      };
      process_corporate_events_refresh_all: { Args: never; Returns: undefined };
      process_due_recurring_occurrences: {
        Args: { p_user_id?: string };
        Returns: {
          failed_count: number;
          posted_count: number;
          processed_count: number;
        }[];
      };
      process_recurring_finance: { Args: never; Returns: undefined };
      process_research_summary_refresh_all: { Args: never; Returns: undefined };
      process_stock_price_refresh_all: { Args: never; Returns: undefined };
      provision_default_categories: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      provision_default_categories_self: { Args: never; Returns: undefined };
      provision_system_accounts: { Args: never; Returns: undefined };
      record_investment_adjustment: {
        Args: {
          p_cost_basis_delta?: number;
          p_holding_id: string;
          p_notes: string;
          p_quantity_delta?: number;
          p_trade_date: string;
        };
        Returns: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_investment_contribution: {
        Args: {
          p_funding_account_id: string;
          p_gross_amount: number;
          p_holding_id: string;
          p_idempotency_key: string;
          p_notes?: string;
          p_trade_date: string;
        };
        Returns: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_investment_fee: {
        Args: {
          p_category_id?: string;
          p_funding_account_id: string;
          p_gross_amount: number;
          p_holding_id: string;
          p_idempotency_key: string;
          p_notes?: string;
          p_trade_date: string;
        };
        Returns: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_investment_income: {
        Args: {
          p_activity_kind: string;
          p_category_id: string;
          p_gross_amount: number;
          p_holding_id: string;
          p_idempotency_key: string;
          p_notes?: string;
          p_payee_id?: string;
          p_receiving_account_id: string;
          p_trade_date: string;
        };
        Returns: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_investment_purchase: {
        Args: {
          p_fee_amount?: number;
          p_funding_account_id: string;
          p_holding_id: string;
          p_idempotency_key: string;
          p_notes?: string;
          p_quantity: number;
          p_settlement_date?: string;
          p_trade_date: string;
          p_unit_price: number;
        };
        Returns: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_investment_sale: {
        Args: {
          p_fee_amount?: number;
          p_holding_id: string;
          p_idempotency_key: string;
          p_notes?: string;
          p_quantity: number;
          p_receiving_account_id: string;
          p_settlement_date?: string;
          p_tax_amount?: number;
          p_trade_date: string;
          p_unit_price: number;
        };
        Returns: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_investment_withdrawal: {
        Args: {
          p_gross_amount: number;
          p_holding_id: string;
          p_idempotency_key: string;
          p_notes?: string;
          p_receiving_account_id: string;
          p_trade_date: string;
        };
        Returns: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      recurring_occurrence_date: {
        Args: {
          p_anchor: string;
          p_frequency: string;
          p_interval_count: number;
          p_k: number;
        };
        Returns: string;
      };
      reject_ai_job: { Args: { p_job_id: string }; Returns: undefined };
      research_review_reminders: {
        Args: never;
        Returns: {
          due_date: string;
          instrument_id: string;
          related_id: string;
          reminder_type: string;
          title: string;
        }[];
      };
      retry_failed_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: {
          amount: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          linked_transaction_id: string | null;
          processed_at: string | null;
          recurring_item_id: string;
          scheduled_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "recurring_occurrences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reverse_investment_activity: {
        Args: { p_activity_id: string };
        Returns: {
          activity_kind: string;
          category_id: string | null;
          cost_basis_amount: number | null;
          created_at: string;
          currency: string;
          fee_amount: number;
          gross_amount: number;
          holding_id: string;
          id: string;
          idempotency_key: string | null;
          ledger_transaction_id: string | null;
          notes: string | null;
          payee_id: string | null;
          quantity: number | null;
          realized_gain_amount: number | null;
          reversal_of: string | null;
          reversed_by: string | null;
          settlement_date: string | null;
          status: string;
          tax_amount: number;
          trade_date: string;
          unit_price: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reverse_transaction: {
        Args: {
          p_reason?: string;
          p_reversed_at?: string;
          p_transaction_id: string;
        };
        Returns: {
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
          payee_id: string | null;
          replaces_transaction_id: string | null;
          reversal_of: string | null;
          reversed_by: string | null;
          source_reference: string | null;
          source_type: string;
          status: string;
          transaction_type: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "ledger_transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      revert_statement_import_to_reviewing: {
        Args: { p_import_id: string };
        Returns: {
          account_id: string;
          amount_column: string | null;
          amount_sign_convention: string | null;
          balance_column: string | null;
          closing_balance: number | null;
          column_mapping_id: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          credit_column: string | null;
          currency: string;
          date_column: string | null;
          date_format: string | null;
          debit_column: string | null;
          description_column: string | null;
          detected_delimiter: string;
          detected_encoding: string;
          discarded_at: string | null;
          duplicate_rows: number;
          error_code: string | null;
          excluded_rows: number;
          expected_closing_balance: number | null;
          file_format: string;
          file_hash: string;
          file_size_bytes: number;
          header_fingerprint: string;
          id: string;
          imported_rows: number;
          invalid_rows: number;
          mapped_at: string | null;
          matched_rows: number;
          opening_balance: number | null;
          original_filename: string;
          parsed_at: string | null;
          reconciliation_status: string;
          reference_column: string | null;
          row_count_hint: number | null;
          statement_end_date: string | null;
          statement_start_date: string | null;
          status: string;
          total_rows: number;
          transaction_type_column: string | null;
          updated_at: string;
          user_id: string;
          valid_rows: number;
          value_date_column: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_imports";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      run_ai_job_cleanup: { Args: never; Returns: undefined };
      run_amfi_refresh: { Args: never; Returns: number };
      run_fundamentals_refresh: {
        Args: { p_instrument_ids: string[] };
        Returns: boolean;
      };
      run_fundamentals_refresh_self: {
        Args: never;
        Returns: {
          instruments_requested: number;
          queued: boolean;
          retry_after_seconds: number;
        }[];
      };
      run_market_data_refresh_self: {
        Args: never;
        Returns: {
          instruments_requested: number;
          queued: boolean;
          retry_after_seconds: number;
        }[];
      };
      run_portfolio_snapshot_for_all: {
        Args: never;
        Returns: {
          users_processed: number;
        }[];
      };
      run_recurring_catchup_self: {
        Args: never;
        Returns: {
          failed_count: number;
          posted_count: number;
          processed_count: number;
        }[];
      };
      run_stock_price_refresh: {
        Args: { p_instrument_ids: string[] };
        Returns: undefined;
      };
      save_budget_allocations: {
        Args: {
          p_allocations: Json;
          p_budget_period_id: string;
          p_notes?: string;
          p_planned_income?: number;
        };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          notes: string | null;
          period_month: string;
          planned_income: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "budget_periods";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_statement_column_mapping: {
        Args: {
          p_amount_column?: string;
          p_amount_sign_convention?: string;
          p_balance_column?: string;
          p_bank_label?: string;
          p_credit_column?: string;
          p_date_column: string;
          p_date_format: string;
          p_debit_column?: string;
          p_description_column: string;
          p_header_fingerprint: string;
          p_reference_column?: string;
          p_transaction_type_column?: string;
          p_value_date_column?: string;
        };
        Returns: {
          amount_column: string | null;
          amount_sign_convention: string;
          balance_column: string | null;
          bank_label: string | null;
          created_at: string;
          credit_column: string | null;
          date_column: string;
          date_format: string;
          debit_column: string | null;
          description_column: string;
          header_fingerprint: string;
          id: string;
          reference_column: string | null;
          transaction_type_column: string | null;
          updated_at: string;
          user_id: string;
          value_date_column: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_column_mappings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_statement_import_rule: {
        Args: {
          p_account_id?: string;
          p_direction_filter?: string;
          p_exclude?: boolean;
          p_match_field: string;
          p_match_value: string;
          p_max_amount?: number;
          p_min_amount?: number;
          p_name: string;
          p_notes_template?: string;
          p_priority?: number;
          p_rule_id?: string;
          p_suggested_category_id?: string;
          p_suggested_payee_id?: string;
          p_suggested_transaction_type?: string;
        };
        Returns: {
          account_id: string | null;
          created_at: string;
          direction_filter: string | null;
          exclude: boolean;
          id: string;
          is_active: boolean;
          match_field: string;
          match_value: string;
          max_amount: number | null;
          min_amount: number | null;
          name: string;
          notes_template: string | null;
          priority: number;
          suggested_category_id: string | null;
          suggested_payee_id: string | null;
          suggested_transaction_type: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "statement_import_rules";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      search_market_instruments: {
        Args: { p_instrument_kind?: string; p_limit?: number; p_query: string };
        Returns: {
          created_at: string;
          exchange: string | null;
          id: string;
          instrument_kind: string;
          is_active: boolean;
          isin: string | null;
          last_successful_refresh_at: string | null;
          mic: string | null;
          name: string;
          provider: string;
          provider_instrument_id: string;
          quote_currency: string;
          symbol: string | null;
          timezone: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "market_instruments";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_fixed_income_status: {
        Args: { p_holding_id: string; p_status: string };
        Returns: {
          actual_maturity_amount: number | null;
          compounding_frequency: string | null;
          created_at: string;
          expected_maturity_amount: number | null;
          holding_id: string;
          id: string;
          installment_amount: number | null;
          interest_payout_mode: string | null;
          interest_rate: number | null;
          kind: string;
          maturity_date: string | null;
          notes: string | null;
          planned_installments: number | null;
          principal_amount: number | null;
          provider: string | null;
          recurring_item_id: string | null;
          start_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "fixed_income_details";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_investment_asset_status: {
        Args: { p_id: string; p_status: string };
        Returns: {
          asset_kind: string;
          created_at: string;
          currency: string;
          display_name: string;
          exchange: string | null;
          id: string;
          investment_account_id: string | null;
          isin: string | null;
          market_instrument_id: string | null;
          market_link_confirmed_at: string | null;
          notes: string | null;
          scheme_code: string | null;
          status: string;
          symbol: string | null;
          unit_precision: number;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_assets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_investment_holding_status: {
        Args: { p_id: string; p_status: string };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          investment_account_id: string | null;
          investment_asset_id: string;
          opened_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_holdings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_recurring_item_status: {
        Args: { p_id: string; p_status: string };
        Returns: {
          amount: number;
          cancellation_date: string | null;
          category_id: string | null;
          created_at: string;
          currency: string;
          destination_account_id: string | null;
          end_date: string | null;
          frequency: string;
          id: string;
          interval_count: number;
          investment_holding_id: string | null;
          kind: string;
          name: string;
          next_due_date: string | null;
          notes: string | null;
          payee_id: string | null;
          processing_mode: string;
          source_account_id: string | null;
          start_date: string;
          status: string;
          trial_end_date: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "recurring_items";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      skip_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: {
          amount: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          linked_transaction_id: string | null;
          processed_at: string | null;
          recurring_item_id: string;
          scheduled_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "recurring_occurrences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_ai_job: { Args: { p_job_id: string }; Returns: undefined };
      subscription_cost_summary: {
        Args: never;
        Returns: {
          active_subscription_count: number;
          annual_estimate: number;
          monthly_estimate: number;
        }[];
      };
      unlink_investment_asset_market_instrument: {
        Args: { p_asset_id: string };
        Returns: {
          asset_kind: string;
          created_at: string;
          currency: string;
          display_name: string;
          exchange: string | null;
          id: string;
          investment_account_id: string | null;
          isin: string | null;
          market_instrument_id: string | null;
          market_link_confirmed_at: string | null;
          notes: string | null;
          scheme_code: string | null;
          status: string;
          symbol: string | null;
          unit_precision: number;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_assets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      unlink_statement_import_row: {
        Args: { p_row_id: string };
        Returns: {
          account_id: string;
          amount: number | null;
          cheque_number: string | null;
          counterparty_account_id: string | null;
          created_at: string;
          currency: string;
          description: string;
          direction: string | null;
          duplicate_status: string;
          id: string;
          import_id: string;
          linked_created_transaction_id: string | null;
          linked_existing_transaction_id: string | null;
          match_status: string;
          matched_rule_id: string | null;
          notes: string | null;
          posting_result: string | null;
          reference: string | null;
          resolved_transaction_type: string | null;
          row_hash: string;
          row_index: number;
          running_balance: number | null;
          suggested_category_id: string | null;
          suggested_payee_id: string | null;
          suggested_transaction_type: string | null;
          transaction_date: string | null;
          transfer_group_id: string | null;
          updated_at: string;
          user_decision: string;
          user_id: string;
          validation_errors: Json;
          value_date: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_import_rows";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upcoming_maturity_events: {
        Args: { p_within_days?: number };
        Returns: {
          display_name: string;
          expected_maturity_amount: number;
          holding_id: string;
          kind: string;
          maturity_date: string;
        }[];
      };
      update_investment_asset: {
        Args: {
          p_display_name: string;
          p_exchange?: string;
          p_id: string;
          p_isin?: string;
          p_notes?: string;
          p_scheme_code?: string;
          p_symbol?: string;
        };
        Returns: {
          asset_kind: string;
          created_at: string;
          currency: string;
          display_name: string;
          exchange: string | null;
          id: string;
          investment_account_id: string | null;
          isin: string | null;
          market_instrument_id: string | null;
          market_link_confirmed_at: string | null;
          notes: string | null;
          scheme_code: string | null;
          status: string;
          symbol: string | null;
          unit_precision: number;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "investment_assets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_ipo_official_fields: {
        Args: {
          p_anchor_date?: string;
          p_basis_of_allotment_date?: string;
          p_cin?: string;
          p_demat_credit_date?: string;
          p_exchange?: string;
          p_face_value?: number;
          p_final_issue_price?: number;
          p_fresh_issue_amount?: number;
          p_industry?: string;
          p_ipo_issue_id: string;
          p_isin?: string;
          p_issue_close_date?: string;
          p_issue_open_date?: string;
          p_listing_date?: string;
          p_lot_size?: number;
          p_min_application_quantity?: number;
          p_offer_for_sale_amount?: number;
          p_price_band_max?: number;
          p_price_band_min?: number;
          p_refund_date?: string;
          p_source_url?: string;
          p_status?: string;
          p_total_issue_size?: number;
        };
        Returns: {
          added_by_user_id: string;
          anchor_date: string | null;
          basis_of_allotment_date: string | null;
          board: string;
          cin: string | null;
          created_at: string;
          demat_credit_date: string | null;
          exchange: string | null;
          face_value: number | null;
          final_issue_price: number | null;
          fresh_issue_amount: number | null;
          id: string;
          industry: string | null;
          isin: string | null;
          issue_close_date: string | null;
          issue_open_date: string | null;
          issue_type: string;
          issuer_name: string;
          last_verified_at: string;
          linked_confirmed_at: string | null;
          linked_instrument_id: string | null;
          listing_date: string | null;
          lot_size: number | null;
          min_application_quantity: number | null;
          offer_for_sale_amount: number | null;
          price_band_max: number | null;
          price_band_min: number | null;
          refund_date: string | null;
          source_organization: string;
          source_url: string;
          status: string;
          total_issue_size: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "ipo_issues";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_recurring_item: {
        Args: {
          p_amount: number;
          p_category_id?: string;
          p_end_date?: string;
          p_frequency: string;
          p_id: string;
          p_interval_count: number;
          p_name: string;
          p_notes?: string;
          p_payee_id?: string;
          p_processing_mode: string;
        };
        Returns: {
          amount: number;
          cancellation_date: string | null;
          category_id: string | null;
          created_at: string;
          currency: string;
          destination_account_id: string | null;
          end_date: string | null;
          frequency: string;
          id: string;
          interval_count: number;
          investment_holding_id: string | null;
          kind: string;
          name: string;
          next_due_date: string | null;
          notes: string | null;
          payee_id: string | null;
          processing_mode: string;
          source_account_id: string | null;
          start_date: string;
          status: string;
          trial_end_date: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "recurring_items";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_statement_import_row: {
        Args: {
          p_category_id?: string;
          p_counterparty_account_id?: string;
          p_notes?: string;
          p_payee_id?: string;
          p_resolved_transaction_type?: string;
          p_row_id: string;
          p_user_decision?: string;
        };
        Returns: {
          account_id: string;
          amount: number | null;
          cheque_number: string | null;
          counterparty_account_id: string | null;
          created_at: string;
          currency: string;
          description: string;
          direction: string | null;
          duplicate_status: string;
          id: string;
          import_id: string;
          linked_created_transaction_id: string | null;
          linked_existing_transaction_id: string | null;
          match_status: string;
          matched_rule_id: string | null;
          notes: string | null;
          posting_result: string | null;
          reference: string | null;
          resolved_transaction_type: string | null;
          row_hash: string;
          row_index: number;
          running_balance: number | null;
          suggested_category_id: string | null;
          suggested_payee_id: string | null;
          suggested_transaction_type: string | null;
          transaction_date: string | null;
          transfer_group_id: string | null;
          updated_at: string;
          user_decision: string;
          user_id: string;
          validation_errors: Json;
          value_date: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "statement_import_rows";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
