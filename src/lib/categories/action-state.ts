/** Shared action-state shape for category Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type CategoryActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_CATEGORY_ACTION_STATE: CategoryActionState = {
  status: "idle",
};
