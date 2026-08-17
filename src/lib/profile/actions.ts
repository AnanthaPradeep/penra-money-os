"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { ProfileActionState } from "@/lib/profile/action-state";
import { profileSchema } from "@/lib/profile/schema";
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
function logProfileError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[profile:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE =
  "You need to sign in again to update your profile.";
const UPDATE_FAILED_MESSAGE =
  "We couldn't update your profile. Please try again.";

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  // Ownership comes ONLY from the verified session — the submitted form is
  // never trusted for identity, even if it contained an "id" field (it
  // never does; this function doesn't read one).
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = profileSchema.safeParse({
    displayName: readFormString(formData, "displayName"),
    baseCurrency: readFormString(formData, "baseCurrency"),
    locale: readFormString(formData, "locale"),
    timezone: readFormString(formData, "timezone"),
    financialYearStartMonth: Number(
      readFormString(formData, "financialYearStartMonth"),
    ),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  // `.eq("id", user.id)` scopes this to the authenticated user's own row;
  // Row Level Security (see supabase/migrations) is the authoritative
  // enforcement of that regardless of this filter — defence in depth, not
  // the only line of defence. Only the five editable columns are ever
  // written; `id` and `created_at` are never part of this payload, and
  // `updated_at` is left for the database trigger to maintain.
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      base_currency: parsed.data.baseCurrency,
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
      financial_year_start_month: parsed.data.financialYearStartMonth,
    })
    .eq("id", user.id);

  if (error) {
    logProfileError("update", error.code);
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  revalidatePath("/app/settings/profile");

  return { status: "success", message: "Profile updated." };
}
