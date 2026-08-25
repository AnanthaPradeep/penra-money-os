/** Shared action-state shape for AI Server Actions — mirrors src/lib/research/action-state.ts and src/lib/ipo/action-state.ts. */
export type AiActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string; id?: string };

export const INITIAL_AI_ACTION_STATE: AiActionState = {
  status: "idle",
};
