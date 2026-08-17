/**
 * Shared action-state shape for the profile Server Action, kept in its own
 * (non-`"use server"`) module — see src/lib/auth/action-state.ts for why.
 */
export type ProfileActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_PROFILE_ACTION_STATE: ProfileActionState = {
  status: "idle",
};
