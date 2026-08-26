import type { Tables } from "@/types/database.types";

/** A row of `public.financial_goals` (see supabase/migrations/20260826113424_phase12_goals_debts_forecast.sql). */
export type FinancialGoalRow = Tables<"financial_goals">;

/** A row of `public.goal_account_links`. */
export type GoalAccountLinkRow = Tables<"goal_account_links">;

/** A row of `public.goal_milestones`. */
export type GoalMilestoneRow = Tables<"goal_milestones">;

/** A row of `public.goal_contributions`. */
export type GoalContributionRow = Tables<"goal_contributions">;
