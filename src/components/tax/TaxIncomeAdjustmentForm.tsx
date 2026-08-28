"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { saveTaxIncomeAdjustmentAction } from "@/lib/tax/actions";
import { INCOME_CATEGORIES, INCOME_CATEGORY_LABELS } from "@/lib/tax/mapping";

const CATEGORY_OPTIONS = INCOME_CATEGORIES.map((c) => ({
  value: c,
  label: INCOME_CATEGORY_LABELS[c],
}));

export function TaxIncomeAdjustmentForm({
  financialYearId,
}: Readonly<{ financialYearId: string }>) {
  const [state, formAction] = useActionState(
    saveTaxIncomeAdjustmentAction,
    INITIAL_TAX_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Add an income item</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="financialYearId" value={financialYearId} />
          <input type="hidden" name="sourceType" value="manual" />
          <Select
            id="income-category"
            name="category"
            label="Category"
            options={CATEGORY_OPTIONS}
            required
            error={fieldError("category")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="income-gross"
              name="grossAmount"
              label="Gross amount"
              required
              inputMode="decimal"
              error={fieldError("grossAmount")}
            />
            <Field
              id="income-tds"
              name="tdsAmount"
              label="TDS deducted (optional)"
              inputMode="decimal"
              description="Never inferred — enter exactly what was withheld, if any."
              error={fieldError("tdsAmount")}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="isExemptCandidate"
              value="true"
              className="size-4 rounded border-input-border"
            />
            Treat as an exempt-income candidate (e.g. PPF interest)
          </label>
          <Field
            id="income-evidence"
            name="evidenceLabel"
            label="Evidence (optional)"
            placeholder="e.g. Form 16, bank interest certificate"
            error={fieldError("evidenceLabel")}
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Saving…" className="w-fit">
            Add income item
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
