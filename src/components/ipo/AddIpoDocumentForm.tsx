"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_IPO_ACTION_STATE } from "@/lib/ipo/action-state";
import { addIpoDocumentAction } from "@/lib/ipo/actions";
import {
  IPO_DOCUMENT_TYPE_LABELS,
  IPO_DOCUMENT_TYPES,
  IPO_SOURCE_ORGANIZATION_LABELS,
  IPO_SOURCE_ORGANIZATIONS,
} from "@/lib/ipo/types";

type AddIpoDocumentFormProps = {
  ipoIssueId: string;
  onDone: () => void;
};

export function AddIpoDocumentForm({
  ipoIssueId,
  onDone,
}: Readonly<AddIpoDocumentFormProps>) {
  const [state, formAction] = useActionState(
    addIpoDocumentAction,
    INITIAL_IPO_ACTION_STATE,
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
      <input type="hidden" name="ipoIssueId" value={ipoIssueId} />
      <Select
        id="ipo-document-type"
        name="documentType"
        label="Document type"
        required
        options={IPO_DOCUMENT_TYPES.map((t) => ({
          value: t,
          label: IPO_DOCUMENT_TYPE_LABELS[t],
        }))}
      />
      <Field
        id="ipo-document-title"
        name="title"
        label="Title"
        required
        error={fieldError("title")}
      />
      <Select
        id="ipo-document-source-organization"
        name="sourceOrganization"
        label="Source organization"
        required
        description="SEBI/NSE/BSE links must point at that regulator's own domain."
        options={IPO_SOURCE_ORGANIZATIONS.map((o) => ({
          value: o,
          label: IPO_SOURCE_ORGANIZATION_LABELS[o],
        }))}
      />
      <Field
        id="ipo-document-source-url"
        name="sourceUrl"
        label="Source URL"
        required
        placeholder="https://www.sebi.gov.in/..."
        error={fieldError("sourceUrl")}
      />
      <Field
        id="ipo-document-filing-date"
        name="filingDate"
        label="Filing date (optional)"
        type="date"
        error={fieldError("filingDate")}
      />
      <Field
        id="ipo-document-source-page-url"
        name="sourcePageUrl"
        label="Source page URL (optional)"
        description="The listing/index page this document was found on, if different from the document link itself."
        error={fieldError("sourcePageUrl")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Adding…">Add document link</SubmitButton>
    </form>
  );
}
