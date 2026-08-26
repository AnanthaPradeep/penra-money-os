import { Decimal, type Money } from "@/lib/money/decimal";
import { assertLiteral } from "@/lib/types/literal";
import type {
  FinancialGoalRow,
  GoalAccountLinkRow,
  GoalContributionRow,
  GoalMilestoneRow,
} from "@/lib/goals/types";
import type { WalletFundingMode } from "@/lib/wallets/mapping";

export const GOAL_TYPES = [
  "emergency_fund",
  "sinking_fund",
  "major_purchase",
  "travel",
  "education",
  "wedding",
  "home",
  "vehicle",
  "retirement",
  "investment",
  "custom",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergency_fund: "Emergency fund",
  sinking_fund: "Sinking fund",
  major_purchase: "Major purchase",
  travel: "Travel",
  education: "Education",
  wedding: "Wedding",
  home: "Home",
  vehicle: "Vehicle",
  retirement: "Retirement",
  investment: "Investment",
  custom: "Custom",
};

export const GOAL_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
  "archived",
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const EF_TARGET_METHODS = [
  "fixed_amount",
  "months_of_expenses",
] as const;
export type EfTargetMethod = (typeof EF_TARGET_METHODS)[number];

export const SF_CONTRIBUTION_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
] as const;
export type SfContributionFrequency =
  (typeof SF_CONTRIBUTION_FREQUENCIES)[number];

export const GOAL_CONTRIBUTION_TYPES = [
  "allocation_only",
  "account_transfer",
] as const;
export type GoalContributionType = (typeof GOAL_CONTRIBUTION_TYPES)[number];

export const GOAL_CONTRIBUTION_DIRECTIONS = [
  "contribution",
  "withdrawal",
] as const;
export type GoalContributionDirection =
  (typeof GOAL_CONTRIBUTION_DIRECTIONS)[number];

export const GOAL_CONTRIBUTION_STATUSES = ["recorded", "reversed"] as const;
export type GoalContributionStatus =
  (typeof GOAL_CONTRIBUTION_STATUSES)[number];

export type FinancialGoal = {
  id: string;
  name: string;
  goalType: GoalType;
  currency: string;
  targetAmount: Money;
  targetDate: string | null;
  startDate: string;
  priority: number;
  fundingMode: WalletFundingMode;
  purposeWalletId: string | null;
  status: GoalStatus;
  notes: string | null;
  efTargetMethod: EfTargetMethod | null;
  efTargetMonths: number | null;
  efEssentialMonthlyExpense: Money | null;
  efEssentialCategoryIds: string[] | null;
  efEssentialPeriodStart: string | null;
  efEssentialPeriodEnd: string | null;
  sfContributionFrequency: SfContributionFrequency | null;
  sfLinkedRecurringItemId: string | null;
  createdAt: string;
};

export function mapFinancialGoalRow(row: FinancialGoalRow): FinancialGoal {
  return {
    id: row.id,
    name: row.name,
    goalType: assertLiteral(
      row.goal_type,
      GOAL_TYPES,
      "financial_goals.goal_type",
    ),
    currency: row.currency,
    targetAmount: new Decimal(row.target_amount),
    targetDate: row.target_date,
    startDate: row.start_date,
    priority: row.priority,
    fundingMode:
      row.funding_mode === "planning_only" ? "planning_only" : "earmarked",
    purposeWalletId: row.purpose_wallet_id,
    status: assertLiteral(row.status, GOAL_STATUSES, "financial_goals.status"),
    notes: row.notes,
    efTargetMethod:
      row.ef_target_method === null
        ? null
        : assertLiteral(
            row.ef_target_method,
            EF_TARGET_METHODS,
            "financial_goals.ef_target_method",
          ),
    efTargetMonths: row.ef_target_months,
    efEssentialMonthlyExpense:
      row.ef_essential_monthly_expense === null
        ? null
        : new Decimal(row.ef_essential_monthly_expense),
    efEssentialCategoryIds: row.ef_essential_category_ids,
    efEssentialPeriodStart: row.ef_essential_period_start,
    efEssentialPeriodEnd: row.ef_essential_period_end,
    sfContributionFrequency:
      row.sf_contribution_frequency === null
        ? null
        : assertLiteral(
            row.sf_contribution_frequency,
            SF_CONTRIBUTION_FREQUENCIES,
            "financial_goals.sf_contribution_frequency",
          ),
    sfLinkedRecurringItemId: row.sf_linked_recurring_item_id,
    createdAt: row.created_at,
  };
}

export type GoalAccountLink = {
  id: string;
  goalId: string;
  accountId: string;
};

export function mapGoalAccountLinkRow(
  row: GoalAccountLinkRow,
): GoalAccountLink {
  return { id: row.id, goalId: row.goal_id, accountId: row.account_id };
}

export type GoalMilestone = {
  id: string;
  goalId: string;
  name: string;
  targetAmount: Money;
  achievedAt: string | null;
};

export function mapGoalMilestoneRow(row: GoalMilestoneRow): GoalMilestone {
  return {
    id: row.id,
    goalId: row.goal_id,
    name: row.name,
    targetAmount: new Decimal(row.target_amount),
    achievedAt: row.achieved_at,
  };
}

export type GoalContribution = {
  id: string;
  goalId: string;
  contributionType: GoalContributionType;
  direction: GoalContributionDirection;
  amount: Money;
  currency: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  relatedTransactionId: string | null;
  status: GoalContributionStatus;
  occurredAt: string;
  notes: string | null;
};

export function mapGoalContributionRow(
  row: GoalContributionRow,
): GoalContribution {
  return {
    id: row.id,
    goalId: row.goal_id,
    contributionType: assertLiteral(
      row.contribution_type,
      GOAL_CONTRIBUTION_TYPES,
      "goal_contributions.contribution_type",
    ),
    direction: assertLiteral(
      row.direction,
      GOAL_CONTRIBUTION_DIRECTIONS,
      "goal_contributions.direction",
    ),
    amount: new Decimal(row.amount),
    currency: row.currency,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    relatedTransactionId: row.related_transaction_id,
    status: assertLiteral(
      row.status,
      GOAL_CONTRIBUTION_STATUSES,
      "goal_contributions.status",
    ),
    occurredAt: row.occurred_at,
    notes: row.notes,
  };
}

/** Net funded amount for a goal — sum of recorded contributions minus recorded withdrawals. Reversed rows never count. */
export function goalFundedAmount(contributions: GoalContribution[]): Money {
  return contributions
    .filter((c) => c.status === "recorded")
    .reduce((total, c) => {
      return c.direction === "contribution"
        ? total.plus(c.amount)
        : total.minus(c.amount);
    }, new Decimal(0));
}
