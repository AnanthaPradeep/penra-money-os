import { Decimal, type Money } from "@/lib/money/decimal";
import { assertLiteral } from "@/lib/types/literal";
import type {
  IncomeAllocationApplicationRow,
  IncomeAllocationPlanLineRow,
  IncomeAllocationPlanRow,
  PurposeWalletMovementRow,
  PurposeWalletRow,
  TransactionPurposeAllocationRow,
} from "@/lib/wallets/types";

export const WALLET_FUNDING_MODES = ["earmarked", "planning_only"] as const;
export type WalletFundingMode = (typeof WALLET_FUNDING_MODES)[number];

export const WALLET_STATUSES = ["active", "archived"] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

/** Mirrors purpose_wallet_movements_kind_valid — see purpose_wallet_movements_sign_matches_kind for which kinds increase vs. decrease a wallet's balance. */
export const MOVEMENT_KINDS = [
  "manual_allocation",
  "reallocation_in",
  "reallocation_out",
  "income_plan_allocation",
  "goal_contribution",
  "goal_withdrawal",
  "expense_spend",
  "expense_reversal",
  "release",
] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const INCOME_ALLOCATION_MODES = [
  "percentage",
  "fixed_amount",
  "hybrid",
  "manual",
] as const;
export type IncomeAllocationMode = (typeof INCOME_ALLOCATION_MODES)[number];

export const INCOME_ALLOCATION_PLAN_STATUSES = [
  "active",
  "paused",
  "archived",
] as const;
export type IncomeAllocationPlanStatus =
  (typeof INCOME_ALLOCATION_PLAN_STATUSES)[number];

export const INCOME_ALLOCATION_APPLICATION_STATUSES = [
  "applied",
  "reversed",
] as const;
export type IncomeAllocationApplicationStatus =
  (typeof INCOME_ALLOCATION_APPLICATION_STATUSES)[number];

export type PurposeWallet = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  currency: string;
  priority: number;
  targetAmount: Money | null;
  fundingMode: WalletFundingMode;
  status: WalletStatus;
  createdAt: string;
};

export function mapPurposeWalletRow(row: PurposeWalletRow): PurposeWallet {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    description: row.description,
    currency: row.currency,
    priority: row.priority,
    targetAmount:
      row.target_amount === null ? null : new Decimal(row.target_amount),
    fundingMode: assertLiteral(
      row.funding_mode,
      WALLET_FUNDING_MODES,
      "purpose_wallets.funding_mode",
    ),
    status: assertLiteral(
      row.status,
      WALLET_STATUSES,
      "purpose_wallets.status",
    ),
    createdAt: row.created_at,
  };
}

export type PurposeWalletMovement = {
  id: string;
  walletId: string;
  movementKind: MovementKind;
  amount: Money;
  currency: string;
  counterpartyWalletId: string | null;
  relatedTransactionId: string | null;
  relatedIncomeApplicationId: string | null;
  movementGroupId: string | null;
  memo: string | null;
  createdAt: string;
};

export function mapPurposeWalletMovementRow(
  row: PurposeWalletMovementRow,
): PurposeWalletMovement {
  return {
    id: row.id,
    walletId: row.wallet_id,
    movementKind: assertLiteral(
      row.movement_kind,
      MOVEMENT_KINDS,
      "purpose_wallet_movements.movement_kind",
    ),
    amount: new Decimal(row.amount),
    currency: row.currency,
    counterpartyWalletId: row.counterparty_wallet_id,
    relatedTransactionId: row.related_transaction_id,
    relatedIncomeApplicationId: row.related_income_application_id,
    movementGroupId: row.movement_group_id,
    memo: row.memo,
    createdAt: row.created_at,
  };
}

export type TransactionPurposeAllocation = {
  id: string;
  transactionId: string;
  walletId: string;
  amount: Money;
  createdAt: string;
};

export function mapTransactionPurposeAllocationRow(
  row: TransactionPurposeAllocationRow,
): TransactionPurposeAllocation {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    walletId: row.wallet_id,
    amount: new Decimal(row.amount),
    createdAt: row.created_at,
  };
}

export type IncomeAllocationPlan = {
  id: string;
  name: string;
  allocationMode: IncomeAllocationMode;
  triggerCategoryId: string | null;
  triggerPayeeId: string | null;
  triggerAccountId: string | null;
  currency: string;
  effectiveDate: string;
  endDate: string | null;
  status: IncomeAllocationPlanStatus;
};

export function mapIncomeAllocationPlanRow(
  row: IncomeAllocationPlanRow,
): IncomeAllocationPlan {
  return {
    id: row.id,
    name: row.name,
    allocationMode: assertLiteral(
      row.allocation_mode,
      INCOME_ALLOCATION_MODES,
      "income_allocation_plans.allocation_mode",
    ),
    triggerCategoryId: row.trigger_category_id,
    triggerPayeeId: row.trigger_payee_id,
    triggerAccountId: row.trigger_account_id,
    currency: row.currency,
    effectiveDate: row.effective_date,
    endDate: row.end_date,
    status: assertLiteral(
      row.status,
      INCOME_ALLOCATION_PLAN_STATUSES,
      "income_allocation_plans.status",
    ),
  };
}

export type IncomeAllocationPlanLine = {
  id: string;
  planId: string;
  walletId: string;
  lineOrder: number;
  percentage: Money | null;
  fixedAmount: Money | null;
};

export function mapIncomeAllocationPlanLineRow(
  row: IncomeAllocationPlanLineRow,
): IncomeAllocationPlanLine {
  return {
    id: row.id,
    planId: row.plan_id,
    walletId: row.wallet_id,
    lineOrder: row.line_order,
    percentage: row.percentage === null ? null : new Decimal(row.percentage),
    fixedAmount:
      row.fixed_amount === null ? null : new Decimal(row.fixed_amount),
  };
}

export type IncomeAllocationApplication = {
  id: string;
  planId: string;
  transactionId: string;
  allocatedTotal: Money;
  unallocatedRemainder: Money;
  status: IncomeAllocationApplicationStatus;
  createdAt: string;
  reversedAt: string | null;
};

export function mapIncomeAllocationApplicationRow(
  row: IncomeAllocationApplicationRow,
): IncomeAllocationApplication {
  return {
    id: row.id,
    planId: row.plan_id,
    transactionId: row.transaction_id,
    allocatedTotal: new Decimal(row.allocated_total),
    unallocatedRemainder: new Decimal(row.unallocated_remainder),
    status: assertLiteral(
      row.status,
      INCOME_ALLOCATION_APPLICATION_STATUSES,
      "income_allocation_applications.status",
    ),
    createdAt: row.created_at,
    reversedAt: row.reversed_at,
  };
}

export type PurposeWalletSummary = {
  walletId: string;
  name: string;
  currency: string;
  fundingMode: WalletFundingMode;
  status: WalletStatus;
  targetAmount: Money | null;
  allocatedBalance: Money;
  spentAmount: Money;
  overspentAmount: Money;
};

export type SafeToSpendSummary = {
  currency: string;
  eligibleLiquidBalance: Money;
  earmarkedAllocation: Money;
  nearTermCommitments: Money;
  safeToSpend: Money;
  asOf: string;
};
