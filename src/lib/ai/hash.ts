import { createHash } from "node:crypto";

import type { AiJobKind } from "@/lib/ai/types";

/**
 * Deterministic hash of an AI job's inputs — sorted source-chunk id list +
 * job kind + prompt template version (+ question text for
 * research_question jobs). Feeds create_ai_job's p_input_hash, which the
 * database enforces as unique per (user, in-progress status) via
 * ai_jobs_no_duplicate_concurrent — this is what makes "prevent duplicate
 * concurrent jobs for the same user, source set, job type and prompt
 * version" actually work, since two calls with the same inputs always
 * produce the same hash.
 */
export function computeAiJobInputHash(input: {
  jobKind: AiJobKind;
  promptTemplateVersion: string;
  chunkIds: readonly string[];
  questionText?: string | null;
}): string {
  const sortedChunkIds = [...input.chunkIds].sort();
  const parts = [
    input.jobKind,
    input.promptTemplateVersion,
    sortedChunkIds.join(","),
    input.questionText?.trim().toLowerCase() ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Content hash for a source_document_chunks row — content_text is required, non-null input. */
export function computeChunkContentHash(contentText: string): string {
  return createHash("sha256").update(contentText).digest("hex");
}
