import type { Tables } from "@/types/database.types";

/** A row of `public.purpose_wallets` (see supabase/migrations/20260826112813_phase12_purpose_wallets.sql). */
export type PurposeWalletRow = Tables<"purpose_wallets">;

/** A row of `public.purpose_wallet_movements` — the immutable, append-only ledger every wallet balance is derived from. */
export type PurposeWalletMovementRow = Tables<"purpose_wallet_movements">;

/** A row of `public.transaction_purpose_allocations` — at most one wallet per ledger transaction. */
export type TransactionPurposeAllocationRow =
  Tables<"transaction_purpose_allocations">;

/** A row of `public.income_allocation_plans`. */
export type IncomeAllocationPlanRow = Tables<"income_allocation_plans">;

/** A row of `public.income_allocation_plan_lines`. */
export type IncomeAllocationPlanLineRow =
  Tables<"income_allocation_plan_lines">;

/** A row of `public.income_allocation_applications`. */
export type IncomeAllocationApplicationRow =
  Tables<"income_allocation_applications">;
