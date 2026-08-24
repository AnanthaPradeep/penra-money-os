/** Shared action-state shape for research/watchlist Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type ResearchActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string; id?: string };

export const INITIAL_RESEARCH_ACTION_STATE: ResearchActionState = {
  status: "idle",
};
