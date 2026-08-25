import { Decimal, type Money } from "@/lib/money/decimal";
import {
  AI_CAPABILITIES,
  AI_HUMAN_REVIEW_STATUSES,
  AI_JOB_KINDS,
  AI_JOB_STATUSES,
  AI_PROVIDERS,
  AI_SCOPE_TYPES,
  AI_SECTION_TYPES,
  CHUNK_EXTRACTION_STATUSES,
  type AiCapability,
  type AiHumanReviewStatus,
  type AiJobKind,
  type AiJobOutputRow,
  type AiJobRow,
  type AiJobSourceRow,
  type AiJobStatus,
  type AiProvider,
  type AiProviderModelRow,
  type AiScopeType,
  type AiSectionType,
  type AiUsageDailyRow,
  type ChunkExtractionStatus,
  type SourceDocumentChunkRow,
} from "@/lib/ai/types";
import { assertLiteral } from "@/lib/types/literal";

export type AiProviderModel = {
  id: string;
  provider: AiProvider;
  modelId: string;
  capability: AiCapability;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutSeconds: number;
  fallbackModelId: string | null;
  costPer1kInputUsd: Money | null;
  costPer1kOutputUsd: Money | null;
  perJobMaxOutputTokens: number;
  dailySpendCapUsd: Money;
  monthlySpendCapUsd: Money;
  isEnabled: boolean;
};

function toMoney(value: number | null): Money | null {
  return value === null ? null : new Decimal(value);
}

export function mapAiProviderModelRow(
  row: AiProviderModelRow,
): AiProviderModel {
  return {
    id: row.id,
    provider: assertLiteral(
      row.provider,
      AI_PROVIDERS,
      "ai_provider_models.provider",
    ),
    modelId: row.model_id,
    capability: assertLiteral(
      row.capability,
      AI_CAPABILITIES,
      "ai_provider_models.capability",
    ),
    maxInputTokens: row.max_input_tokens,
    maxOutputTokens: row.max_output_tokens,
    timeoutSeconds: row.timeout_seconds,
    fallbackModelId: row.fallback_model_id,
    costPer1kInputUsd: toMoney(row.cost_per_1k_input_usd),
    costPer1kOutputUsd: toMoney(row.cost_per_1k_output_usd),
    perJobMaxOutputTokens: row.per_job_max_output_tokens,
    dailySpendCapUsd: new Decimal(row.daily_spend_cap_usd),
    monthlySpendCapUsd: new Decimal(row.monthly_spend_cap_usd),
    isEnabled: row.is_enabled,
  };
}

export type AiJob = {
  id: string;
  userId: string;
  jobKind: AiJobKind;
  provider: AiProvider;
  modelId: string;
  status: AiJobStatus;
  scopeType: AiScopeType;
  scopeInstrumentId: string | null;
  scopeIpoIssueId: string | null;
  scopeCompareInstrumentIds: string[] | null;
  questionText: string | null;
  promptTemplateVersion: string;
  inputHash: string;
  outputHash: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: Money | null;
  durationMs: number | null;
  errorCode: string | null;
  retryCount: number;
  humanReviewStatus: AiHumanReviewStatus | null;
};

export function mapAiJobRow(row: AiJobRow): AiJob {
  return {
    id: row.id,
    userId: row.user_id,
    jobKind: assertLiteral(row.job_kind, AI_JOB_KINDS, "ai_jobs.job_kind"),
    provider: assertLiteral(row.provider, AI_PROVIDERS, "ai_jobs.provider"),
    modelId: row.model_id,
    status: assertLiteral(row.status, AI_JOB_STATUSES, "ai_jobs.status"),
    scopeType: assertLiteral(
      row.scope_type,
      AI_SCOPE_TYPES,
      "ai_jobs.scope_type",
    ),
    scopeInstrumentId: row.scope_instrument_id,
    scopeIpoIssueId: row.scope_ipo_issue_id,
    scopeCompareInstrumentIds: row.scope_compare_instrument_ids,
    questionText: row.question_text,
    promptTemplateVersion: row.prompt_template_version,
    inputHash: row.input_hash,
    outputHash: row.output_hash,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd: toMoney(row.estimated_cost_usd),
    durationMs: row.duration_ms,
    errorCode: row.error_code,
    retryCount: row.retry_count,
    humanReviewStatus:
      row.human_review_status === null
        ? null
        : assertLiteral(
            row.human_review_status,
            AI_HUMAN_REVIEW_STATUSES,
            "ai_jobs.human_review_status",
          ),
  };
}

export type AiJobSource = {
  id: string;
  jobId: string;
  chunkId: string;
  createdAt: string;
};

export function mapAiJobSourceRow(row: AiJobSourceRow): AiJobSource {
  return {
    id: row.id,
    jobId: row.job_id,
    chunkId: row.chunk_id,
    createdAt: row.created_at,
  };
}

export type AiJobOutput = {
  id: string;
  jobId: string;
  sectionType: AiSectionType;
  content: string;
  citations: string[];
  displayOrder: number;
  accepted: boolean;
  acceptedAt: string | null;
  isUserEdited: boolean;
  savedAsTable: string | null;
  savedAsId: string | null;
  createdAt: string;
};

function toCitations(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return (value as unknown[]).filter(
    (entry): entry is string => typeof entry === "string",
  );
}

export function mapAiJobOutputRow(row: AiJobOutputRow): AiJobOutput {
  return {
    id: row.id,
    jobId: row.job_id,
    sectionType: assertLiteral(
      row.section_type,
      AI_SECTION_TYPES,
      "ai_job_outputs.section_type",
    ),
    content: row.content,
    citations: toCitations(row.citations),
    displayOrder: row.display_order,
    accepted: row.accepted,
    acceptedAt: row.accepted_at,
    isUserEdited: row.is_user_edited,
    savedAsTable: row.saved_as_table,
    savedAsId: row.saved_as_id,
    createdAt: row.created_at,
  };
}

export type AiUsageDaily = {
  id: string;
  userId: string;
  usageDate: string;
  jobsCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: Money;
  updatedAt: string;
};

export function mapAiUsageDailyRow(row: AiUsageDailyRow): AiUsageDaily {
  return {
    id: row.id,
    userId: row.user_id,
    usageDate: row.usage_date,
    jobsCount: row.jobs_count,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd: new Decimal(row.estimated_cost_usd),
    updatedAt: row.updated_at,
  };
}

export type SourceDocumentChunk = {
  id: string;
  userId: string;
  ipoDocumentId: string | null;
  companyFilingId: string | null;
  pageNumber: number | null;
  sectionHeading: string | null;
  contentText: string;
  contentHash: string;
  extractionStatus: ChunkExtractionStatus;
  extractorVersion: string;
  createdAt: string;
};

export function mapSourceDocumentChunkRow(
  row: SourceDocumentChunkRow,
): SourceDocumentChunk {
  return {
    id: row.id,
    userId: row.user_id,
    ipoDocumentId: row.ipo_document_id,
    companyFilingId: row.company_filing_id,
    pageNumber: row.page_number,
    sectionHeading: row.section_heading,
    contentText: row.content_text,
    contentHash: row.content_hash,
    extractionStatus: assertLiteral(
      row.extraction_status,
      CHUNK_EXTRACTION_STATUSES,
      "source_document_chunks.extraction_status",
    ),
    extractorVersion: row.extractor_version,
    createdAt: row.created_at,
  };
}
