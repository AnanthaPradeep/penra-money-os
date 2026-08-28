"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { saveTaxWithholdingAction } from "@/lib/tax/actions";
import { WITHHOLDING_TYPES, WITHHOLDING_TYPE_LABELS } from "@/lib/tax/mapping";

const TYPE_OPTIONS = WITHHOLDING_TYPES.map((t) => ({
  value: t,
  label: WITHHOLDING_TYPE_LABELS[t],
}));

export function TaxWithholdingForm({
  financialYearId,
}: Readonly<{ financialYearId: string }>) {
  const [state, formAction] = useActionState(
    saveTaxWithholdingAction,
    INITIAL_TAX_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Add TDS/TCS</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="financialYearId" value={financialYearId} />
          <Select
            id="withholding-type"
            name="withholdingType"
            label="Type"
            options={TYPE_OPTIONS}
            required
            error={fieldError("withholdingType")}
          />
          <Field
            id="withholding-deductor"
            name="deductorName"
            label="Deductor/source name"
            required
            error={fieldError("deductorName")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="withholding-gross"
              name="grossAmount"
              label="Gross amount"
              required
              inputMode="decimal"
              error={fieldError("grossAmount")}
            />
            <Field
              id="withholding-tax"
              name="taxWithheld"
              label="Tax withheld"
              required
              inputMode="decimal"
              error={fieldError("taxWithheld")}
            />
          </div>
          <Field
            id="withholding-date"
            name="withheldOn"
            label="Date"
            type="date"
            required
            error={fieldError("withheldOn")}
          />
          <Field
            id="withholding-reference"
            name="referenceLabel"
            label="Reference (optional)"
            error={fieldError("referenceLabel")}
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Saving…" className="w-fit">
            Add record
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
