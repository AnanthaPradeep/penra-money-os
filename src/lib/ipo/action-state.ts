/** Shared action-state shape for IPO Server Actions — mirrors src/lib/research/action-state.ts. */
export type IpoActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string; id?: string };

export const INITIAL_IPO_ACTION_STATE: IpoActionState = {
  status: "idle",
};
