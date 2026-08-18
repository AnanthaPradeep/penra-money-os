import type { Tables } from "@/types/database.types";

/** A row of `public.ledger_transactions` (see supabase/migrations), from the generated Database type. */
export type LedgerTransactionRow = Tables<"ledger_transactions">;

/** A row of `public.ledger_entries` (see supabase/migrations), from the generated Database type. */
export type LedgerEntryRow = Tables<"ledger_entries">;
