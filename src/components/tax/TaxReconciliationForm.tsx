"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { saveTaxReconciliationItemAction } from "@/lib/tax/actions";
import {
  RECONCILIATION_SOURCE_LABELS,
  RECONCILIATION_SOURCES,
  RECONCILIATION_STATUSES,
} from "@/lib/tax/mapping";

const SOURCE_OPTIONS = RECONCILIATION_SOURCES.map((s) => ({
  value: s,
  label: RECONCILIATION_SOURCE_LABELS[s],
}));
const STATUS_OPTIONS = RECONCILIATION_STATUSES.map((s) => ({
  value: s,
  label: s.replace(/_/g, " "),
}));

export function TaxReconciliationForm({
  financialYearId,
}: Readonly<{ financialYearId: string }>) {
  const [state, formAction] = useActionState(
    saveTaxReconciliationItemAction,
    INITIAL_TAX_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Add a reconciliation item</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="financialYearId" value={financialYearId} />
          <Select
            id="reconciliation-source"
            name="source"
            label="Source"
            options={SOURCE_OPTIONS}
            required
            error={fieldError("source")}
          />
          <Field
            id="reconciliation-category"
            name="incomeCategory"
            label="Income category"
            required
            placeholder="e.g. salary_tds, dividend"
            error={fieldError("incomeCategory")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="reconciliation-reported"
              name="reportedAmount"
              label="Reported by source (optional)"
              inputMode="decimal"
              error={fieldError("reportedAmount")}
            />
            <Field
              id="reconciliation-penra"
              name="penraAmount"
              label="PENRA-derived figure (optional)"
              inputMode="decimal"
              error={fieldError("penraAmount")}
            />
          </div>
          <Select
            id="reconciliation-status"
            name="status"
            label="Status"
            options={STATUS_OPTIONS}
            defaultValue="unreviewed"
            error={fieldError("status")}
          />
          <Field
            id="reconciliation-explanation"
            name="explanation"
            label="Explanation (optional)"
            error={fieldError("explanation")}
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Saving…" className="w-fit">
            Save item
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
