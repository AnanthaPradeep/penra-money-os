"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { saveTaxDeductionAction } from "@/lib/tax/actions";

export function TaxDeductionForm({
  financialYearId,
}: Readonly<{ financialYearId: string }>) {
  const [state, formAction] = useActionState(
    saveTaxDeductionAction,
    INITIAL_TAX_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Add a deduction</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="financialYearId" value={financialYearId} />
          <Field
            id="deduction-section"
            name="section"
            label="Section"
            required
            placeholder="e.g. 80C, 80D, 24b"
            error={fieldError("section")}
          />
          <Field
            id="deduction-amount"
            name="claimedAmount"
            label="Claimed amount"
            required
            inputMode="decimal"
            error={fieldError("claimedAmount")}
          />
          <Field
            id="deduction-evidence"
            name="evidenceLabel"
            label="Evidence (optional)"
            placeholder="e.g. PPF passbook, insurance premium receipt"
            error={fieldError("evidenceLabel")}
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Saving…" className="w-fit">
            Add deduction
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
