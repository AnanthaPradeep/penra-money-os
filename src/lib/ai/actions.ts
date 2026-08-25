"use server";

import type { z } from "zod";

import type { AiActionState } from "@/lib/ai/action-state";
import { computeAiJobInputHash, computeChunkContentHash } from "@/lib/ai/hash";
import {
  acceptAiJobOutputSchema,
  addSourceDocumentChunkSchema,
  createAiJobSchema,
  rejectAiJobSchema,
} from "@/lib/ai/schema";
import type { AiJobQueueRejectionReason } from "@/lib/ai/types";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readFormStringArray(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.trim().length > 0);
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
function logAiError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[ai:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to use research AI.";
const SAVE_FAILED_MESSAGE = "We couldn't save that. Please try again.";

export async function addSourceDocumentChunkAction(
  _prevState: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = addSourceDocumentChunkSchema.safeParse({
    ipoDocumentId: readFormString(formData, "ipoDocumentId") || undefined,
    companyFilingId: readFormString(formData, "companyFilingId") || undefined,
    pageNumber: readFormString(formData, "pageNumber") || undefined,
    sectionHeading: readFormString(formData, "sectionHeading") || undefined,
    contentText: readFormString(formData, "contentText"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { data: created, error } = await supabase
    .from("source_document_chunks")
    .insert({
      user_id: user.id,
      ipo_document_id: data.ipoDocumentId ?? null,
      company_filing_id: data.companyFilingId ?? null,
      page_number: data.pageNumber ?? null,
      section_heading: data.sectionHeading ?? null,
      content_text: data.contentText,
      content_hash: computeChunkContentHash(data.contentText),
    })
    .select("id")
    .single();

  if (error || !created) {
    logAiError("add-chunk", error?.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Excerpt saved.", id: created.id };
}

export async function deleteSourceDocumentChunkAction(
  _prevState: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const chunkId = readFormString(formData, "chunkId");
  if (!chunkId) {
    return { status: "error", message: "Missing excerpt." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("source_document_chunks")
    .delete()
    .eq("id", chunkId);

  if (error) {
    logAiError("delete-chunk", error.code);
    return { status: "error", message: "We couldn't remove that excerpt." };
  }

  return { status: "success", message: "Excerpt removed." };
}

const QUEUE_REJECTION_MESSAGES: Record<AiJobQueueRejectionReason, string> = {
  provider_not_configured:
    "No AI provider is configured yet. An administrator needs to enable a model in AI settings before this will work.",
  daily_spend_cap_exceeded:
    "Today's AI spend cap has been reached for this model. Try again tomorrow.",
  duplicate_job_in_progress:
    "A matching request is already in progress — check the AI jobs list.",
};

export async function createAiJobAction(
  _prevState: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const chunkIds = readFormStringArray(formData, "chunkIds");
  const compareIds = readFormStringArray(formData, "scopeCompareInstrumentIds");
  const parsed = createAiJobSchema.safeParse({
    jobKind: readFormString(formData, "jobKind"),
    provider: readFormString(formData, "provider"),
    modelId: readFormString(formData, "modelId"),
    scopeType: readFormString(formData, "scopeType"),
    scopeInstrumentId:
      readFormString(formData, "scopeInstrumentId") || undefined,
    scopeIpoIssueId: readFormString(formData, "scopeIpoIssueId") || undefined,
    scopeCompareInstrumentIds: compareIds.length > 0 ? compareIds : undefined,
    questionText: readFormString(formData, "questionText") || undefined,
    chunkIds,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const promptTemplateVersion = "v1";
  const inputHash = computeAiJobInputHash({
    jobKind: data.jobKind,
    promptTemplateVersion,
    chunkIds: data.chunkIds,
    questionText: data.questionText ?? null,
  });

  const { data: result, error } = await supabase.rpc("create_ai_job", {
    p_job_kind: data.jobKind,
    p_provider: data.provider,
    p_model_id: data.modelId,
    p_scope_type: data.scopeType,
    p_prompt_template_version: promptTemplateVersion,
    p_input_hash: inputHash,
    p_chunk_ids: data.chunkIds,
    ...(data.scopeInstrumentId
      ? { p_scope_instrument_id: data.scopeInstrumentId }
      : {}),
    ...(data.scopeIpoIssueId
      ? { p_scope_ipo_issue_id: data.scopeIpoIssueId }
      : {}),
    ...(data.scopeCompareInstrumentIds
      ? { p_scope_compare_instrument_ids: data.scopeCompareInstrumentIds }
      : {}),
    ...(data.questionText ? { p_question_text: data.questionText } : {}),
  });

  if (error) {
    logAiError("create-job", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const outcome = result?.[0];
  if (!outcome || !outcome.queued) {
    const reason = outcome?.reason;
    const message =
      reason && reason in QUEUE_REJECTION_MESSAGES
        ? QUEUE_REJECTION_MESSAGES[reason as AiJobQueueRejectionReason]
        : "This request couldn't be queued. Please try again.";
    return { status: "error", message };
  }

  return {
    status: "success",
    message: "Request queued.",
    id: outcome.job_id ?? undefined,
  };
}

export async function acceptAiJobOutputAction(
  _prevState: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = acceptAiJobOutputSchema.safeParse({
    outputId: readFormString(formData, "outputId"),
    editedContent: readFormString(formData, "editedContent") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase.rpc("accept_ai_job_output", {
    p_output_id: data.outputId,
    ...(data.editedContent ? { p_edited_content: data.editedContent } : {}),
  });

  if (error) {
    logAiError("accept-output", error.code);
    if (error.code === "42501") {
      return {
        status: "error",
        message: "Only the person who requested this can review it.",
      };
    }
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Section accepted." };
}

export async function rejectAiJobAction(
  _prevState: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = rejectAiJobSchema.safeParse({
    jobId: readFormString(formData, "jobId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reject_ai_job", {
    p_job_id: parsed.data.jobId,
  });

  if (error) {
    logAiError("reject-job", error.code);
    if (error.code === "42501") {
      return {
        status: "error",
        message: "Only the person who requested this can reject it.",
      };
    }
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Output rejected." };
}
