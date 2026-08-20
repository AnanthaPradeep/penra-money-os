"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { CategoryActionState } from "@/lib/categories/action-state";
import { categoryFormSchema } from "@/lib/categories/schema";
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
function logCategoryError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[categories:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage categories.";
const CREATE_FAILED_MESSAGE =
  "We couldn't create that category. Please try again.";
const UPDATE_FAILED_MESSAGE =
  "We couldn't update that category. Please try again.";
const ARCHIVE_FAILED_MESSAGE =
  "We couldn't update that category. Please try again.";
const DUPLICATE_NAME_MESSAGE =
  "You already have a category with that name and type.";

/**
 * Categories are plain user-owned rows — creation goes straight through
 * Row Level Security (see supabase/migrations), no SECURITY DEFINER
 * function is needed since there is no cross-table invariant to enforce
 * atomically (unlike transaction creation, which references a category).
 */
export async function createCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = categoryFormSchema.safeParse({
    name: readFormString(formData, "name"),
    categoryType: readFormString(formData, "categoryType"),
    icon: readFormString(formData, "icon") || undefined,
    color: readFormString(formData, "color") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    category_type: parsed.data.categoryType,
    name: parsed.data.name,
    normalized_name: parsed.data.name.toLowerCase(),
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
  });

  if (error) {
    logCategoryError("create", error.code);
    if (error.code === "23505") {
      return {
        status: "error",
        message: DUPLICATE_NAME_MESSAGE,
        fieldErrors: { name: DUPLICATE_NAME_MESSAGE },
      };
    }
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  revalidatePath("/app/categories");
  revalidatePath("/app/transactions/new");

  return { status: "success", message: "Category created." };
}

/** Renames a custom category and/or changes its icon/colour. System categories are never updatable (RLS silently rejects it). */
export async function updateCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const categoryId = readFormString(formData, "categoryId");
  if (!categoryId) {
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  const parsed = categoryFormSchema.omit({ categoryType: true }).safeParse({
    name: readFormString(formData, "name"),
    icon: readFormString(formData, "icon") || undefined,
    color: readFormString(formData, "color") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      normalized_name: parsed.data.name.toLowerCase(),
      icon: parsed.data.icon ?? null,
      color: parsed.data.color ?? null,
    })
    .eq("id", categoryId)
    .eq("is_system", false)
    .select("id")
    .maybeSingle();

  if (error) {
    logCategoryError("update", error.code);
    if (error.code === "23505") {
      return {
        status: "error",
        message: DUPLICATE_NAME_MESSAGE,
        fieldErrors: { name: DUPLICATE_NAME_MESSAGE },
      };
    }
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  if (!data) {
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  revalidatePath("/app/categories");

  return { status: "success", message: "Category updated." };
}

/** Toggles archive state for a custom category. System categories can never be archived (RLS silently rejects it). */
export async function setCategoryArchivedAction(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const categoryId = readFormString(formData, "categoryId");
  const isArchived = readFormString(formData, "isArchived") === "true";
  if (!categoryId) {
    return { status: "error", message: ARCHIVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("categories")
    .update({ is_archived: isArchived })
    .eq("id", categoryId)
    .eq("is_system", false);

  if (error) {
    logCategoryError("archive", error.code);
    return { status: "error", message: ARCHIVE_FAILED_MESSAGE };
  }

  revalidatePath("/app/categories");

  return {
    status: "success",
    message: isArchived ? "Category archived." : "Category restored.",
  };
}
