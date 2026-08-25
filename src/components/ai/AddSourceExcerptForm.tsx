"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextareaField } from "@/components/ui/TextareaField";
import { INITIAL_AI_ACTION_STATE } from "@/lib/ai/action-state";
import { addSourceDocumentChunkAction } from "@/lib/ai/actions";

type AddSourceExcerptFormProps = {
  ipoDocumentId?: string;
  companyFilingId?: string;
  onDone: () => void;
};

/**
 * Transcribes one human-typed excerpt of an official document as a
 * citable AI source — exactly one of ipoDocumentId/companyFilingId is
 * always passed by the caller (see source_document_chunks_exactly_one_parent).
 * No automated PDF extraction exists; this is always a manual copy of
 * text the user is personally reading.
 */
export function AddSourceExcerptForm({
  ipoDocumentId,
  companyFilingId,
  onDone,
}: Readonly<AddSourceExcerptFormProps>) {
  const [state, formAction] = useActionState(
    addSourceDocumentChunkAction,
    INITIAL_AI_ACTION_STATE,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {ipoDocumentId ? (
        <input type="hidden" name="ipoDocumentId" value={ipoDocumentId} />
      ) : null}
      {companyFilingId ? (
        <input type="hidden" name="companyFilingId" value={companyFilingId} />
      ) : null}
      <TextareaField
        id="chunk-content-text"
        name="contentText"
        label="Excerpt text"
        rows={6}
        required
        description="Paste the exact text you're reading from the document — this becomes a citable AI source."
        error={fieldError("contentText")}
      />
      <Field
        id="chunk-page-number"
        name="pageNumber"
        label="Page number (optional)"
        type="number"
        error={fieldError("pageNumber")}
      />
      <Field
        id="chunk-section-heading"
        name="sectionHeading"
        label="Section heading (optional)"
        error={fieldError("sectionHeading")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Saving…">Save excerpt</SubmitButton>
    </form>
  );
}
