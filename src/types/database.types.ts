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
    PostgrestVersion: "14.15";
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
          latest_valuation: number;
          latest_valuation_at: string;
          quantity: number;
          realized_gain: number;
          status: string;
          symbol: string;
          unrealized_gain: number;
        }[];
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
      process_due_recurring_occurrences: {
        Args: { p_user_id?: string };
        Returns: {
          failed_count: number;
          posted_count: number;
          processed_count: number;
        }[];
      };
      process_recurring_finance: { Args: never; Returns: undefined };
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
      run_recurring_catchup_self: {
        Args: never;
        Returns: {
          failed_count: number;
          posted_count: number;
          processed_count: number;
        }[];
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
      subscription_cost_summary: {
        Args: never;
        Returns: {
          active_subscription_count: number;
          annual_estimate: number;
          monthly_estimate: number;
        }[];
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
