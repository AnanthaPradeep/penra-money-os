"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { InstitutionActionState } from "@/lib/institutions/action-state";
import { institutionFormSchema } from "@/lib/institutions/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Logs only a Postgrest error code, never its message (which can echo back data). */
function logInstitutionError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[institutions:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE =
  "You need to sign in again to manage institutions.";
const CREATE_FAILED_MESSAGE =
  "We couldn't create that institution. Please try again.";

/**
 * Institutions are plain user-owned rows — creation goes straight through
 * Row Level Security (see supabase/migrations), no SECURITY DEFINER
 * function is needed since there is no cross-table invariant to enforce
 * atomically (unlike account/transaction creation).
 */
export async function createInstitutionAction(
  _prevState: InstitutionActionState,
  formData: FormData,
): Promise<InstitutionActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = institutionFormSchema.safeParse({
    name: readFormString(formData, "name"),
    institutionType: readFormString(formData, "institutionType"),
    website: readFormString(formData, "website"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  // user_id always comes from the verified session, never the form — the
  // form does not even contain an id field for this action to read.
  const { data, error } = await supabase
    .from("institutions")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      institution_type: parsed.data.institutionType,
      website: parsed.data.website ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    logInstitutionError("create", error?.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  revalidatePath("/app/accounts/new");

  return {
    status: "success",
    message: "Institution created.",
    institution: { id: data.id, name: data.name },
  };
}
