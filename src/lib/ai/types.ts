import type { Tables } from "@/types/database.types";

export type AiProviderModelRow = Tables<"ai_provider_models">;
export type AiJobRow = Tables<"ai_jobs">;
export type AiJobSourceRow = Tables<"ai_job_sources">;
export type AiJobOutputRow = Tables<"ai_job_outputs">;
export type AiUsageDailyRow = Tables<"ai_usage_daily">;
export type SourceDocumentChunkRow = Tables<"source_document_chunks">;

/** Mirrors ai_provider_models_provider_valid in the Phase 10 migration. */
export const AI_PROVIDERS = ["openai", "anthropic"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

/** Mirrors ai_provider_models_capability_valid. */
export const AI_CAPABILITIES = [
  "chat_completion",
  "chat_completion_with_citations",
] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];

/** Mirrors ai_jobs_kind_valid — every AiJobKind from spec section 12. */
export const AI_JOB_KINDS = [
  "document_summary",
  "company_update_summary",
  "ipo_summary",
  "risk_extraction",
  "research_question",
  "thesis_change_review",
] as const;
export type AiJobKind = (typeof AI_JOB_KINDS)[number];

export const AI_JOB_KIND_LABELS: Record<AiJobKind, string> = {
  document_summary: "Document summary",
  company_update_summary: "Company update summary",
  ipo_summary: "IPO summary",
  risk_extraction: "Risk extraction",
  research_question: "Research question",
  thesis_change_review: "Thesis change review",
};

/** Mirrors ai_jobs_status_valid. */
export const AI_JOB_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "blocked",
] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export const AI_JOB_STATUS_LABELS: Record<AiJobStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  blocked: "Blocked",
};

/** Mirrors ai_jobs_scope_type_valid. */
export const AI_SCOPE_TYPES = [
  "company",
  "ipo",
  "documents",
  "comparison",
] as const;
export type AiScopeType = (typeof AI_SCOPE_TYPES)[number];

/** Mirrors ai_job_outputs_section_valid — the 5 stored section types. "source_citations" (the spec's 6th section) is rendered app-side as the deduplicated union of every section's citations, never stored as its own row. */
export const AI_SECTION_TYPES = [
  "facts",
  "interpretations",
  "risks",
  "unknowns",
  "questions_for_review",
] as const;
export type AiSectionType = (typeof AI_SECTION_TYPES)[number];

export const AI_SECTION_TYPE_LABELS: Record<AiSectionType, string> = {
  facts: "Facts",
  interpretations: "Interpretations",
  risks: "Risks",
  unknowns: "Unknowns",
  questions_for_review: "Questions for review",
};

/** Mirrors ai_jobs_human_review_status_valid. Null until the caller reviews at least one output. */
export const AI_HUMAN_REVIEW_STATUSES = [
  "accepted_all",
  "accepted_partial",
  "rejected",
] as const;
export type AiHumanReviewStatus = (typeof AI_HUMAN_REVIEW_STATUSES)[number];

/** Mirrors source_document_chunks_extraction_status_valid — currently always "manual" (no automated PDF/OCR pipeline exists). */
export const CHUNK_EXTRACTION_STATUSES = ["manual"] as const;
export type ChunkExtractionStatus = (typeof CHUNK_EXTRACTION_STATUSES)[number];

/** create_ai_job's soft-failure reasons — returned as a typed result rather than a thrown error, since these are routine/expected conditions. */
export const AI_JOB_QUEUE_REJECTION_REASONS = [
  "provider_not_configured",
  "daily_spend_cap_exceeded",
  "duplicate_job_in_progress",
] as const;
export type AiJobQueueRejectionReason =
  (typeof AI_JOB_QUEUE_REJECTION_REASONS)[number];
