"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_IPO_ACTION_STATE } from "@/lib/ipo/action-state";
import { addIpoFinancialMetricAction } from "@/lib/ipo/actions";
import type { IpoDocument } from "@/lib/ipo/mapping";
import {
  IPO_METRIC_KEYS,
  IPO_METRIC_LABELS,
  IPO_STATEMENT_BASES,
  IPO_UNIT_SCALES,
} from "@/lib/ipo/types";

const STATEMENT_BASIS_LABELS: Record<
  (typeof IPO_STATEMENT_BASES)[number],
  string
> = {
  consolidated: "Consolidated",
  standalone: "Standalone",
};

const UNIT_SCALE_LABELS: Record<(typeof IPO_UNIT_SCALES)[number], string> = {
  unit: "Unit (₹)",
  thousand: "Thousand",
  lakh: "Lakh",
  million: "Million",
  crore: "Crore",
};

type AddIpoFinancialMetricFormProps = {
  ipoIssueId: string;
  documents: IpoDocument[];
  onDone: () => void;
};

export function AddIpoFinancialMetricForm({
  ipoIssueId,
  documents,
  onDone,
}: Readonly<AddIpoFinancialMetricFormProps>) {
  const [state, formAction] = useActionState(
    addIpoFinancialMetricAction,
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
        id="ipo-metric-key"
        name="metricKey"
        label="Metric"
        required
        options={IPO_METRIC_KEYS.map((k) => ({
          value: k,
          label: IPO_METRIC_LABELS[k],
        }))}
      />
      <Field
        id="ipo-metric-fiscal-period-end"
        name="fiscalPeriodEnd"
        label="Fiscal period end"
        type="date"
        required
        error={fieldError("fiscalPeriodEnd")}
      />
      <Field
        id="ipo-metric-value"
        name="value"
        label="Value"
        type="number"
        step="any"
        required
        error={fieldError("value")}
      />
      <Select
        id="ipo-metric-unit-scale"
        name="unitScale"
        label="Unit"
        defaultValue="unit"
        options={IPO_UNIT_SCALES.map((u) => ({
          value: u,
          label: UNIT_SCALE_LABELS[u],
        }))}
      />
      <Select
        id="ipo-metric-statement-basis"
        name="statementBasis"
        label="Statement basis"
        defaultValue="consolidated"
        options={IPO_STATEMENT_BASES.map((b) => ({
          value: b,
          label: STATEMENT_BASIS_LABELS[b],
        }))}
      />
      {documents.length > 0 ? (
        <Select
          id="ipo-metric-source-document"
          name="sourceDocumentId"
          label="Source document (optional)"
          placeholder="No specific document"
          options={documents.map((d) => ({ value: d.id, label: d.title }))}
        />
      ) : null}
      <Field
        id="ipo-metric-source-citation"
        name="sourceCitation"
        label="Source citation (optional)"
        description={`e.g. "RHP p.42, Restated Financial Statements"`}
        error={fieldError("sourceCitation")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Adding…">Add financial metric</SubmitButton>
    </form>
  );
}
