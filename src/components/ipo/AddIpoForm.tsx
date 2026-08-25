"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_IPO_ACTION_STATE } from "@/lib/ipo/action-state";
import { addIpoAction } from "@/lib/ipo/actions";
import {
  IPO_BOARD_LABELS,
  IPO_BOARDS,
  IPO_ISSUE_TYPE_LABELS,
  IPO_ISSUE_TYPES,
  IPO_SOURCE_ORGANIZATION_LABELS,
  IPO_SOURCE_ORGANIZATIONS,
} from "@/lib/ipo/types";

type AddIpoFormProps = {
  onDone: () => void;
};

/**
 * Adds an IPO to the shared catalogue from an official source only — the
 * source URL is validated server-side against the allowlisted SEBI/NSE/BSE
 * domains (see src/lib/ipo/url.ts) when that source organization is
 * selected. Never fabricates a date/status; those are added later via
 * update_ipo_official_fields once confirmed against the source.
 */
export function AddIpoForm({ onDone }: Readonly<AddIpoFormProps>) {
  const [state, formAction] = useActionState(
    addIpoAction,
    INITIAL_IPO_ACTION_STATE,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.id) {
      router.refresh();
      router.push(`/app/ipos/${state.id}`);
      onDone();
    }
  }, [state, router, onDone]);

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field
        id="ipo-issuer-name"
        name="issuerName"
        label="Issuer name"
        required
        error={fieldError("issuerName")}
      />
      <Select
        id="ipo-board"
        name="board"
        label="Board"
        defaultValue="mainboard"
        options={IPO_BOARDS.map((b) => ({
          value: b,
          label: IPO_BOARD_LABELS[b],
        }))}
      />
      <Select
        id="ipo-issue-type"
        name="issueType"
        label="Issue type"
        defaultValue="fresh_and_ofs"
        options={IPO_ISSUE_TYPES.map((t) => ({
          value: t,
          label: IPO_ISSUE_TYPE_LABELS[t],
        }))}
      />
      <Select
        id="ipo-source-organization"
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
        id="ipo-source-url"
        name="sourceUrl"
        label="Source URL"
        required
        placeholder="https://www.sebi.gov.in/..."
        error={fieldError("sourceUrl")}
      />
      <Field
        id="ipo-cin"
        name="cin"
        label="CIN (optional)"
        error={fieldError("cin")}
      />
      <Field
        id="ipo-isin"
        name="isin"
        label="ISIN (optional)"
        error={fieldError("isin")}
      />
      <Field
        id="ipo-exchange"
        name="exchange"
        label="Exchange (optional)"
        placeholder="NSE, BSE"
        error={fieldError("exchange")}
      />
      <Field
        id="ipo-industry"
        name="industry"
        label="Industry (optional)"
        error={fieldError("industry")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Adding…">Add IPO</SubmitButton>
    </form>
  );
}
