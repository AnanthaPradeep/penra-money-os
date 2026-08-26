/** Shared action-state shape for financial-goal Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type GoalActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_GOAL_ACTION_STATE: GoalActionState = {
  status: "idle",
};
