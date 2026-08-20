"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { PayeeActionState } from "@/lib/payees/action-state";
import { payeeFormSchema } from "@/lib/payees/schema";
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

function logPayeeError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[payees:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage payees.";
const CREATE_FAILED_MESSAGE = "We couldn't save that payee. Please try again.";
const ARCHIVE_FAILED_MESSAGE =
  "We couldn't update that payee. Please try again.";

/**
 * Creates a payee, or returns the caller's existing active payee of the
 * same (case/whitespace-insensitive) name if one already exists — so the
 * "type a new payee name and submit" flow in the transaction composer
 * never errors out on an accidental near-duplicate, it just reuses the
 * existing row.
 */
export async function createPayeeAction(
  _prevState: PayeeActionState,
  formData: FormData,
): Promise<PayeeActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = payeeFormSchema.safeParse({
    name: readFormString(formData, "name"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const normalizedName = parsed.data.name.toLowerCase();

  const { data, error } = await supabase
    .from("payees")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      normalized_name: normalizedName,
    })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("payees")
        .select("id, name")
        .eq("normalized_name", normalizedName)
        .eq("is_archived", false)
        .maybeSingle();

      if (existing) {
        return {
          status: "success",
          message: "Using your existing payee.",
          payee: { id: existing.id, name: existing.name },
        };
      }
    }
    logPayeeError("create", error.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  if (!data) {
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  revalidatePath("/app/transactions/new");

  return {
    status: "success",
    message: "Payee added.",
    payee: { id: data.id, name: data.name },
  };
}

/** Archives a payee the user no longer wants to see offered — past transactions keep referencing it unchanged. */
export async function archivePayeeAction(
  _prevState: PayeeActionState,
  formData: FormData,
): Promise<PayeeActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const payeeId = readFormString(formData, "payeeId");
  if (!payeeId) {
    return { status: "error", message: ARCHIVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("payees")
    .update({ is_archived: true })
    .eq("id", payeeId)
    .select("id, name")
    .maybeSingle();

  if (error || !data) {
    logPayeeError("archive", error?.code);
    return { status: "error", message: ARCHIVE_FAILED_MESSAGE };
  }

  revalidatePath("/app/transactions/new");

  return {
    status: "success",
    message: "Payee archived.",
    payee: { id: data.id, name: data.name },
  };
}
