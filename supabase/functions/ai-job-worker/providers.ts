/**
 * Pure request-building and response-parsing for the two supported
 * providers (openai/anthropic) — no Deno global, no `npm:` import, no
 * network call, so this runs unmodified under both the deployed Deno
 * Edge Function and Vitest (./providers.test.ts). The actual fetch I/O
 * lives in ./index.ts, mirroring
 * ../company-fundamentals-refresh/index.ts's split between the pure
 * response-mapping module and the network-calling orchestrator.
 *
 * IMPORTANT — honesty note: neither OPENAI_API_KEY nor ANTHROPIC_API_KEY
 * exists in this environment, and every seeded ai_provider_models row has
 * is_enabled=false (see the Phase 10 migration section 9) — so
 * create_ai_job() never queues a job against either provider, and this
 * code path has never executed against a live API in this environment.
 * The request/response shapes below follow each provider's stable,
 * publicly documented Chat Completions / Messages API — a materially
 * more standardized and higher-confidence basis than
 * corporate-events-refresh's Twelve Data mapping — but this must still
 * never be reported as tested, verified, or live until a real key is
 * configured and a real response is checked against these parsers.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type ChatMessage = { role: "system" | "user"; content: string };

export function buildOpenAiRequestBody(
  modelId: string,
  messages: readonly ChatMessage[],
  maxOutputTokens: number,
): Record<string, unknown> {
  return {
    model: modelId,
    messages,
    max_tokens: maxOutputTokens,
    temperature: 0,
    response_format: { type: "json_object" },
  };
}

export type ProviderTextResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

/** Parses an OpenAI /v1/chat/completions response, never trusting its shape. */
export function parseOpenAiResponse(
  body: unknown,
): ProviderTextResponse | null {
  if (!isRecord(body)) {
    return null;
  }
  const choices = body["choices"];
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const message = isRecord(choices[0]) ? choices[0]["message"] : undefined;
  const text = isRecord(message) ? message["content"] : undefined;
  if (typeof text !== "string") {
    return null;
  }
  const usage = body["usage"];
  const inputTokens =
    isRecord(usage) && typeof usage["prompt_tokens"] === "number"
      ? usage["prompt_tokens"]
      : 0;
  const outputTokens =
    isRecord(usage) && typeof usage["completion_tokens"] === "number"
      ? usage["completion_tokens"]
      : 0;
  return { text, inputTokens, outputTokens };
}

export function buildAnthropicRequestBody(
  modelId: string,
  systemPrompt: string,
  userContent: string,
  maxOutputTokens: number,
): Record<string, unknown> {
  return {
    model: modelId,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
    max_tokens: maxOutputTokens,
    temperature: 0,
  };
}

/** Parses an Anthropic /v1/messages response, never trusting its shape. */
export function parseAnthropicResponse(
  body: unknown,
): ProviderTextResponse | null {
  if (!isRecord(body)) {
    return null;
  }
  const content = body["content"];
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }
  const firstBlock = (content as unknown[])[0];
  const text = isRecord(firstBlock) ? firstBlock["text"] : undefined;
  if (typeof text !== "string") {
    return null;
  }
  const usage = body["usage"];
  const inputTokens =
    isRecord(usage) && typeof usage["input_tokens"] === "number"
      ? usage["input_tokens"]
      : 0;
  const outputTokens =
    isRecord(usage) && typeof usage["output_tokens"] === "number"
      ? usage["output_tokens"]
      : 0;
  return { text, inputTokens, outputTokens };
}

// ---------------------------------------------------------------------
// Structured-output parsing — the model is instructed (see safety.ts's
// buildResearchSystemPrompt) to respond with exactly this JSON shape.
// ---------------------------------------------------------------------

export const STRUCTURED_SECTION_KEYS = [
  "facts",
  "interpretations",
  "risks",
  "unknowns",
  "questions_for_review",
] as const;
export type StructuredSectionKey = (typeof STRUCTURED_SECTION_KEYS)[number];

export type StructuredSectionEntry = {
  content: string;
  citations: string[];
};

export type StructuredOutput = Record<
  StructuredSectionKey,
  StructuredSectionEntry[]
>;

function parseEntryList(value: unknown): StructuredSectionEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: StructuredSectionEntry[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw["content"] !== "string") {
      continue;
    }
    const content = raw["content"].trim();
    if (content.length === 0) {
      continue;
    }
    const citations = Array.isArray(raw["citations"])
      ? raw["citations"].filter(
          (c): c is string => typeof c === "string" && c.trim().length > 0,
        )
      : [];
    entries.push({ content, citations });
  }
  return entries;
}

/**
 * Parses the model's raw text response as the required structured JSON
 * object. Returns null for anything that fails to parse as JSON or isn't
 * an object — the caller treats that as a provider_response_malformed
 * failure, never a partial/best-effort extraction.
 */
export function parseStructuredOutput(
  rawText: string,
): StructuredOutput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const result = {} as StructuredOutput;
  for (const key of STRUCTURED_SECTION_KEYS) {
    result[key] = parseEntryList(parsed[key]);
  }
  return result;
}

/**
 * Pure pre-flight mirror of complete_ai_job's own citation check (see the
 * Phase 10 migration section 14) — lets the worker block a job with a
 * clear error code BEFORE ever calling complete_ai_job, rather than
 * relying solely on the database rejecting it. The database check remains
 * authoritative regardless (see the pgTAP test that rejects a fabricated
 * citation) — this is defence-in-depth, not a replacement for it.
 */
export function findInvalidCitations(
  output: StructuredOutput,
  authorizedChunkIds: readonly string[],
): string[] {
  const authorized = new Set(authorizedChunkIds);
  const invalid = new Set<string>();
  for (const key of STRUCTURED_SECTION_KEYS) {
    for (const entry of output[key]) {
      for (const citation of entry.citations) {
        if (!authorized.has(citation)) {
          invalid.add(citation);
        }
      }
    }
  }
  return [...invalid];
}

/**
 * "Claims without support go to unknowns" (spec section 10) — a
 * facts/interpretations/risks entry the model produced with zero
 * citations is demoted into unknowns rather than stored under a factual
 * label it can't back up, and rather than rejecting an otherwise
 * well-cited job over one ungrounded entry. Never promotes anything the
 * other direction.
 */
export function demoteUncitedClaims(
  output: StructuredOutput,
): StructuredOutput {
  const citedSections: readonly StructuredSectionKey[] = [
    "facts",
    "interpretations",
    "risks",
  ];
  const result: StructuredOutput = {
    facts: [],
    interpretations: [],
    risks: [],
    unknowns: [...output.unknowns],
    questions_for_review: [...output.questions_for_review],
  };
  for (const key of citedSections) {
    for (const entry of output[key]) {
      if (entry.citations.length === 0) {
        result.unknowns.push({ content: entry.content, citations: [] });
      } else {
        result[key].push(entry);
      }
    }
  }
  return result;
}
