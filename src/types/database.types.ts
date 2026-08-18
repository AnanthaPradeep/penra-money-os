export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
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
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
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
          created_at?: string;
          description: string;
          id?: string;
          notes?: string | null;
          occurred_at: string;
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
          created_at?: string;
          description?: string;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
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
      create_account_with_opening_balance: {
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
      create_manual_transaction: {
        Args: {
          p_description: string;
          p_entries: Json;
          p_notes?: string;
          p_occurred_at: string;
          p_transaction_type: string;
        };
        Returns: {
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
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
      provision_system_accounts: { Args: never; Returns: undefined };
      reverse_transaction: {
        Args: {
          p_reason?: string;
          p_reversed_at?: string;
          p_transaction_id: string;
        };
        Returns: {
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          occurred_at: string;
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
