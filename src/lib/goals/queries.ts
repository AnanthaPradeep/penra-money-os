import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapFinancialGoalRow,
  mapGoalAccountLinkRow,
  mapGoalContributionRow,
  mapGoalMilestoneRow,
  type FinancialGoal,
  type GoalAccountLink,
  type GoalContribution,
  type GoalMilestone,
  type GoalType,
} from "@/lib/goals/mapping";
import type { Database } from "@/types/database.types";

/** Lists the caller's own financial goals, highest priority first. Excludes archived goals unless requested. */
export async function listFinancialGoals(
  supabase: SupabaseClient<Database>,
  options: { includeArchived?: boolean; goalType?: GoalType } = {},
): Promise<FinancialGoal[]> {
  let query = supabase
    .from("financial_goals")
    .select("*")
    .order("priority", { ascending: false })
    .order("name", { ascending: true });

  if (!options.includeArchived) {
    query = query.neq("status", "archived");
  }
  if (options.goalType) {
    query = query.eq("goal_type", options.goalType);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map(mapFinancialGoalRow);
}

/** Reads a single goal owned by the caller. */
export async function getFinancialGoal(
  supabase: SupabaseClient<Database>,
  goalId: string,
): Promise<FinancialGoal | null> {
  const { data, error } = await supabase
    .from("financial_goals")
    .select("*")
    .eq("id", goalId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapFinancialGoalRow(data);
}

export type GoalDetail = {
  goal: FinancialGoal;
  contributions: GoalContribution[];
  milestones: GoalMilestone[];
  accountLinks: GoalAccountLink[];
};

/** Reads a goal together with its contribution history, milestones, and linked accounts. */
export async function getGoalDetail(
  supabase: SupabaseClient<Database>,
  goalId: string,
): Promise<GoalDetail | null> {
  const [goalResult, contributionsResult, milestonesResult, linksResult] =
    await Promise.all([
      supabase
        .from("financial_goals")
        .select("*")
        .eq("id", goalId)
        .maybeSingle(),
      supabase
        .from("goal_contributions")
        .select("*")
        .eq("goal_id", goalId)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("goal_milestones")
        .select("*")
        .eq("goal_id", goalId)
        .order("target_amount", { ascending: true }),
      supabase.from("goal_account_links").select("*").eq("goal_id", goalId),
    ]);

  if (goalResult.error || !goalResult.data) {
    return null;
  }

  return {
    goal: mapFinancialGoalRow(goalResult.data),
    contributions: (contributionsResult.data ?? []).map(mapGoalContributionRow),
    milestones: (milestonesResult.data ?? []).map(mapGoalMilestoneRow),
    accountLinks: (linksResult.data ?? []).map(mapGoalAccountLinkRow),
  };
}

/** Lists contributions/withdrawals for one goal, newest first. */
export async function listGoalContributions(
  supabase: SupabaseClient<Database>,
  goalId: string,
): Promise<GoalContribution[]> {
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("goal_id", goalId)
    .order("occurred_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapGoalContributionRow);
}
