/** Shared action-state shape for institution Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type InstitutionActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | {
      status: "success";
      message: string;
      institution: { id: string; name: string };
    };

export const INITIAL_INSTITUTION_ACTION_STATE: InstitutionActionState = {
  status: "idle",
};
