/**
 * Shared action-state shape for every auth Server Action, kept in its own
 * (non-`"use server"`) module. A `"use server"` file may only export async
 * functions — exporting a plain constant like `INITIAL_AUTH_ACTION_STATE`
 * alongside the actions in src/lib/auth/actions.ts fails the build
 * ("A 'use server' file can only export async functions, found object").
 */
export type AuthActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_AUTH_ACTION_STATE: AuthActionState = { status: "idle" };
