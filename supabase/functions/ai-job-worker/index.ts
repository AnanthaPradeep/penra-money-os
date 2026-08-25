// Deno Edge Function — processes one queued AI research job: fetches the
// job's authorized source excerpts, calls the configured provider
// (OpenAI or Anthropic), validates the response (citations, forbidden
// advice/guarantee language), and writes the result through
// public.complete_ai_job — never directly into ai_job_outputs, so the
// database's own citation check (see the Phase 10 migration section 14)
// remains the authoritative enforcement even if this worker has a bug.
//
// IMPORTANT — provider state honesty (Phase 10 spec sections 12/13/22):
// neither OPENAI_API_KEY nor ANTHROPIC_API_KEY exists in this
// environment, and every seeded ai_provider_models row has
// is_enabled=false — so this function's "provider not configured" path
// (checked immediately after start_ai_job, before any network call) is
// the path that actually runs today. It records an honest block_ai_job
// outcome and touches no ai_job_outputs row. The credentialed path
// beneath it targets each provider's stable, publicly documented Chat
// Completions (OpenAI) / Messages (Anthropic) API — see ./providers.ts's
// file header for the confidence caveat — but it has NEVER been
// exercised against a live API in this environment and must not be
// reported as tested, verified, or live until a key is configured.
//
// Dispatch: create_ai_job (see the Phase 10 migration section 14, as
// extended by the phase10_ai_job_dispatch follow-up migration) fires
// public.invoke_market_data_function('ai-job-worker', {job_id}) via
// pg_net immediately after successfully queuing a job — the same
// fire-and-forget dispatch pattern every other background job in this
// app uses. Never called directly by a browser; verify_jwt is still true
// (matching every other Edge Function here), satisfied by the anon-role
// JWT invoke_market_data_function sends, with the worker's real authority
// coming from its own service-role client, not the request's JWT role.
import { createClient } from "npm:@supabase/supabase-js@2";

import type { Database } from "../_shared/database.types.ts";
import {
  buildAnthropicRequestBody,
  buildOpenAiRequestBody,
  demoteUncitedClaims,
  findInvalidCitations,
  isRecord,
  parseAnthropicResponse,
  parseOpenAiResponse,
  parseStructuredOutput,
  STRUCTURED_SECTION_KEYS,
  type ChatMessage,
  type ProviderTextResponse,
} from "./providers.ts";
import {
  buildResearchSystemPrompt,
  detectAdviceRequest,
  validateOutputForForbiddenLanguage,
} from "./safety.ts";

type SupabaseServiceClient = ReturnType<typeof createClient<Database>>;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const JOB_KIND_INSTRUCTIONS: Record<string, string> = {
  document_summary: "Summarize the supplied source excerpts.",
  company_update_summary:
    "Summarize what the supplied source excerpts say has changed or been announced.",
  ipo_summary: "Summarize the supplied source excerpts about this IPO.",
  risk_extraction:
    "Extract every risk factor disclosed in the supplied source excerpts.",
  thesis_change_review:
    "Summarize what the supplied source excerpts say that may be relevant to reviewing an existing investment thesis.",
  research_question: "", // the job's own question_text is used instead
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildUserContent(
  chunks: readonly { id: string; content_text: string }[],
  instruction: string,
): string {
  const sourceBlocks = chunks
    .map((c) => `SOURCE [${c.id}]:\n${c.content_text}`)
    .join("\n\n---\n\n");
  return `${instruction}\n\n${sourceBlocks || "(no source excerpts supplied)"}`;
}

type CallOutcome =
  | { kind: "ok"; response: ProviderTextResponse }
  | { kind: "error"; code: string };

async function callProvider(
  provider: string,
  modelId: string,
  systemPrompt: string,
  userContent: string,
  maxOutputTokens: number,
  timeoutSeconds: number,
  apiKey: string,
): Promise<CallOutcome> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    if (provider === "openai") {
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(
            buildOpenAiRequestBody(modelId, messages, maxOutputTokens),
          ),
          signal: controller.signal,
        },
      );
      if (response.status === 401 || response.status === 403) {
        return { kind: "error", code: "provider_auth_failed" };
      }
      if (!response.ok) {
        return { kind: "error", code: `upstream_http_${response.status}` };
      }
      const body: unknown = await response.json();
      const parsed = parseOpenAiResponse(body);
      if (!parsed) {
        return { kind: "error", code: "provider_response_malformed" };
      }
      return { kind: "ok", response: parsed };
    }

    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(
          buildAnthropicRequestBody(
            modelId,
            systemPrompt,
            userContent,
            maxOutputTokens,
          ),
        ),
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        return { kind: "error", code: "provider_auth_failed" };
      }
      if (!response.ok) {
        return { kind: "error", code: `upstream_http_${response.status}` };
      }
      const body: unknown = await response.json();
      const parsed = parseAnthropicResponse(body);
      if (!parsed) {
        return { kind: "error", code: "provider_response_malformed" };
      }
      return { kind: "ok", response: parsed };
    }

    return { kind: "error", code: "unknown_provider" };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return { kind: "error", code: isAbort ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "missing_service_credentials" }, 500);
  }
  const supabase: SupabaseServiceClient = createClient<Database>(
    supabaseUrl,
    serviceRoleKey,
  );

  let jobId: string | null = null;
  try {
    const body: unknown = await req.json();
    jobId =
      isRecord(body) && typeof body["job_id"] === "string"
        ? body["job_id"]
        : null;
  } catch {
    return jsonResponse({ error: "invalid_request_body" }, 400);
  }
  if (!jobId) {
    return jsonResponse({ error: "missing_job_id" }, 400);
  }

  const { data: job } = await supabase
    .from("ai_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return jsonResponse({ error: "job_not_found" }, 404);
  }
  if (job.status !== "queued") {
    // Idempotency guard — a duplicate/retried dispatch for an
    // already-processing or already-finished job is a safe no-op.
    return jsonResponse({ status: "skipped", reason: "not_queued" }, 200);
  }

  await supabase.rpc("start_ai_job", { p_job_id: jobId });

  const { data: model } = await supabase
    .from("ai_provider_models")
    .select("*")
    .eq("provider", job.provider)
    .eq("model_id", job.model_id)
    .maybeSingle();

  if (!model || !model.is_enabled) {
    await supabase.rpc("block_ai_job", {
      p_job_id: jobId,
      p_error_code: "provider_not_configured",
    });
    return jsonResponse(
      { status: "blocked", reason: "provider_not_configured" },
      200,
    );
  }

  const apiKey =
    job.provider === "openai"
      ? Deno.env.get("OPENAI_API_KEY")
      : job.provider === "anthropic"
        ? Deno.env.get("ANTHROPIC_API_KEY")
        : undefined;
  if (!apiKey) {
    await supabase.rpc("block_ai_job", {
      p_job_id: jobId,
      p_error_code: "provider_not_configured",
    });
    return jsonResponse(
      { status: "blocked", reason: "provider_not_configured" },
      200,
    );
  }

  if (job.job_kind === "research_question" && job.question_text) {
    const adviceCheck = detectAdviceRequest(job.question_text);
    if (adviceCheck.blocked) {
      await supabase.rpc("block_ai_job", {
        p_job_id: jobId,
        p_error_code: `advice_request_refused:${adviceCheck.reason}`,
      });
      return jsonResponse(
        { status: "blocked", reason: "advice_request_refused" },
        200,
      );
    }
  }

  const { data: sourceLinks } = await supabase
    .from("ai_job_sources")
    .select("chunk_id")
    .eq("job_id", jobId);
  const chunkIds = (sourceLinks ?? []).map((s) => s.chunk_id);

  const { data: chunkRows } =
    chunkIds.length > 0
      ? await supabase
          .from("source_document_chunks")
          .select("id, content_text")
          .in("id", chunkIds)
      : { data: [] as { id: string; content_text: string }[] };

  const systemPrompt = buildResearchSystemPrompt({
    authorizedChunkIds: chunkIds,
  });
  const instruction =
    job.job_kind === "research_question"
      ? (job.question_text ?? "")
      : (JOB_KIND_INSTRUCTIONS[job.job_kind] ??
        "Summarize the supplied source excerpts.");
  const userContent = buildUserContent(chunkRows ?? [], instruction);

  const startedAt = Date.now();
  const outcome = await callProvider(
    job.provider,
    job.model_id,
    systemPrompt,
    userContent,
    model.per_job_max_output_tokens,
    model.timeout_seconds,
    apiKey,
  );
  const durationMs = Date.now() - startedAt;

  if (outcome.kind !== "ok") {
    if (outcome.code === "provider_auth_failed") {
      await supabase.rpc("block_ai_job", {
        p_job_id: jobId,
        p_error_code: outcome.code,
      });
    } else {
      await supabase.rpc("fail_ai_job", {
        p_job_id: jobId,
        p_error_code: outcome.code,
      });
    }
    return jsonResponse({ status: "failed", reason: outcome.code }, 200);
  }

  const structured = parseStructuredOutput(outcome.response.text);
  if (!structured) {
    await supabase.rpc("block_ai_job", {
      p_job_id: jobId,
      p_error_code: "provider_response_malformed",
    });
    return jsonResponse(
      { status: "blocked", reason: "provider_response_malformed" },
      200,
    );
  }

  const safetyCheck = validateOutputForForbiddenLanguage(
    STRUCTURED_SECTION_KEYS.map((key) =>
      structured[key].map((e) => e.content).join(" "),
    ).join(" "),
  );
  if (!safetyCheck.safe) {
    await supabase.rpc("block_ai_job", {
      p_job_id: jobId,
      p_error_code: `forbidden_language:${safetyCheck.reason}`,
    });
    return jsonResponse(
      { status: "blocked", reason: "forbidden_language" },
      200,
    );
  }

  const demoted = demoteUncitedClaims(structured);
  const invalidCitations = findInvalidCitations(demoted, chunkIds);
  if (invalidCitations.length > 0) {
    await supabase.rpc("block_ai_job", {
      p_job_id: jobId,
      p_error_code: "invalid_citation",
    });
    return jsonResponse({ status: "blocked", reason: "invalid_citation" }, 200);
  }

  const outputs: {
    section_type: string;
    content: string;
    citations: string[];
    display_order: number;
  }[] = [];
  let order = 0;
  for (const key of STRUCTURED_SECTION_KEYS) {
    for (const entry of demoted[key]) {
      outputs.push({
        section_type: key,
        content: entry.content,
        citations: entry.citations,
        display_order: order,
      });
      order += 1;
    }
  }

  const inputCostPer1k = model.cost_per_1k_input_usd ?? 0;
  const outputCostPer1k = model.cost_per_1k_output_usd ?? 0;
  const estimatedCostUsd =
    (outcome.response.inputTokens / 1000) * inputCostPer1k +
    (outcome.response.outputTokens / 1000) * outputCostPer1k;
  const outputHash = await sha256Hex(outcome.response.text);

  const { error: completeError } = await supabase.rpc("complete_ai_job", {
    p_job_id: jobId,
    p_output_hash: outputHash,
    p_input_tokens: outcome.response.inputTokens,
    p_output_tokens: outcome.response.outputTokens,
    p_estimated_cost_usd: estimatedCostUsd,
    p_duration_ms: durationMs,
    p_outputs: outputs,
  });

  if (completeError) {
    // The database's own citation check (complete_ai_job) is the
    // authoritative enforcement — if it rejects what our own pre-flight
    // check accepted, that is itself informative and must not be
    // silently swallowed.
    await supabase.rpc("fail_ai_job", {
      p_job_id: jobId,
      p_error_code: "database_completion_rejected",
    });
    return jsonResponse(
      { status: "failed", reason: "database_completion_rejected" },
      200,
    );
  }

  return jsonResponse({ status: "completed" }, 200);
});
