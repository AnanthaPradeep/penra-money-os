"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextareaField } from "@/components/ui/TextareaField";
import { INITIAL_AI_ACTION_STATE } from "@/lib/ai/action-state";
import { createAiJobAction } from "@/lib/ai/actions";
import type { AiProviderModel, SourceDocumentChunk } from "@/lib/ai/mapping";
import {
  AI_JOB_KIND_LABELS,
  AI_JOB_KINDS,
  AI_PROVIDER_LABELS,
} from "@/lib/ai/types";

type ScopeOption = { id: string; name: string };

function modelKey(m: Pick<AiProviderModel, "provider" | "modelId">): string {
  return `${m.provider}:${m.modelId}`;
}

type AiAssistantFormProps = {
  companies: ScopeOption[];
  ipos: ScopeOption[];
  models: AiProviderModel[];
  chunks: SourceDocumentChunk[];
};

/**
 * The explainable research assistant's job-creation form. Bounded to one
 * company/IPO and an explicit set of the user's own transcribed source
 * excerpts — the assistant is never given open-ended database access.
 * Advice-style questions are refused server-side (see src/lib/ai/safety.ts
 * and the ai-job-worker Edge Function), not filtered here — this form
 * only decides what's authorized to be read, never what conclusion to
 * draw.
 */
export function AiAssistantForm({
  companies,
  ipos,
  models,
  chunks,
}: Readonly<AiAssistantFormProps>) {
  const [state, formAction] = useActionState(
    createAiJobAction,
    INITIAL_AI_ACTION_STATE,
  );
  const router = useRouter();
  const [jobKind, setJobKind] = useState<string>("research_question");
  const [scopeType, setScopeType] = useState<"company" | "ipo">("company");
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);

  const enabledModels = useMemo(
    () => models.filter((m) => m.isEnabled),
    [models],
  );
  const [selectedModelKey, setSelectedModelKey] = useState(
    enabledModels[0] ? modelKey(enabledModels[0]) : "",
  );
  const [selectedProvider, selectedModelId] = selectedModelKey.split(":");

  useEffect(() => {
    if (state.status === "success" && state.id) {
      router.push(`/app/research/ai-jobs/${state.id}`);
    }
  }, [state, router]);

  function toggleChunk(chunkId: string) {
    setSelectedChunkIds((prev) =>
      prev.includes(chunkId)
        ? prev.filter((id) => id !== chunkId)
        : [...prev, chunkId],
    );
  }

  const scopeOptions = scopeType === "company" ? companies : ipos;

  if (enabledModels.length === 0) {
    return (
      <FormMessage
        tone="error"
        message="No AI provider is configured yet, so the assistant can't run. An administrator needs to enable a model in AI settings first."
      />
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="provider" value={selectedProvider ?? ""} />
      <input type="hidden" name="modelId" value={selectedModelId ?? ""} />

      <Select
        id="assistant-job-kind"
        name="jobKind"
        label="What do you want"
        defaultValue="research_question"
        onChange={(e) => setJobKind(e.target.value)}
        options={AI_JOB_KINDS.map((k) => ({
          value: k,
          label: AI_JOB_KIND_LABELS[k],
        }))}
      />
      <Select
        id="assistant-scope-type"
        name="scopeType"
        label="About"
        defaultValue="company"
        onChange={(e) => setScopeType(e.target.value as "company" | "ipo")}
        options={[
          { value: "company", label: "A company" },
          { value: "ipo", label: "An IPO" },
        ]}
      />
      {scopeOptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {scopeType === "company"
            ? "Hold or watch a company to ask about it here."
            : "Watch an IPO to ask about it here."}
        </p>
      ) : (
        <Select
          id="assistant-scope-target"
          name={
            scopeType === "company" ? "scopeInstrumentId" : "scopeIpoIssueId"
          }
          label={scopeType === "company" ? "Company" : "IPO"}
          required
          options={scopeOptions.map((o) => ({ value: o.id, label: o.name }))}
        />
      )}
      <Select
        id="assistant-model"
        name="modelKeyDisplay"
        label="Provider"
        defaultValue={selectedModelKey}
        onChange={(e) => setSelectedModelKey(e.target.value)}
        options={enabledModels.map((m) => ({
          value: modelKey(m),
          label: `${AI_PROVIDER_LABELS[m.provider]} · ${m.modelId}`,
        }))}
      />
      {jobKind === "research_question" ? (
        <TextareaField
          id="assistant-question"
          name="questionText"
          label="Your research question"
          rows={3}
          required
          description="Ask about facts in your selected sources — this assistant can't recommend buying, selling, or predict prices."
        />
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">
          Source excerpts to allow ({selectedChunkIds.length} selected)
        </legend>
        {chunks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t transcribed any source excerpts yet — add some from
            a document or filing&apos;s page first. Without any, the assistant
            has nothing authorized to cite.
          </p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-md border border-border p-2">
            {chunks.map((chunk) => (
              <li key={chunk.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  id={`chunk-${chunk.id}`}
                  checked={selectedChunkIds.includes(chunk.id)}
                  onChange={() => toggleChunk(chunk.id)}
                  className="mt-0.5 size-4 shrink-0 rounded border-input-border"
                />
                <label
                  htmlFor={`chunk-${chunk.id}`}
                  className="flex-1 text-muted-foreground"
                >
                  {chunk.sectionHeading ? `${chunk.sectionHeading} — ` : ""}
                  {chunk.contentText.slice(0, 100)}
                  {chunk.contentText.length > 100 ? "…" : ""}
                </label>
              </li>
            ))}
          </ul>
        )}
        {selectedChunkIds.map((id) => (
          <input key={id} type="hidden" name="chunkIds" value={id} />
        ))}
      </fieldset>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Submitting…">Ask</SubmitButton>
    </form>
  );
}
