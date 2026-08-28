"use client";

import { useActionState, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { saveTaxAssetClassificationAction } from "@/lib/tax/actions";
import { TAX_ASSET_CLASS_LABELS, TAX_ASSET_CLASSES } from "@/lib/tax/mapping";

const CLASS_OPTIONS = TAX_ASSET_CLASSES.map((c) => ({
  value: c,
  label: TAX_ASSET_CLASS_LABELS[c],
}));

type TaxAssetClassificationFormProps = {
  investmentAssetId: string;
  displayName: string;
};

/** Classifies one investment asset for capital-gains tax purposes — never inferred automatically, see tax_asset_classifications' own comment. */
export function TaxAssetClassificationForm({
  investmentAssetId,
  displayName,
}: Readonly<TaxAssetClassificationFormProps>) {
  const [state, formAction] = useActionState(
    saveTaxAssetClassificationAction,
    INITIAL_TAX_ACTION_STATE,
  );
  const [assetClass, setAssetClass] = useState("listed_equity");

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{displayName}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-3">
          <input type="hidden" name="investmentAssetId" value={investmentAssetId} />
          <Select
            id={`asset-class-${investmentAssetId}`}
            name="assetClass"
            label="Tax classification"
            options={CLASS_OPTIONS}
            defaultValue={assetClass}
            onChange={(e) => setAssetClass(e.target.value)}
            error={
              state.status === "error" ? state.fieldErrors?.assetClass : undefined
            }
          />
          {assetClass === "unsupported" ? (
            <Field
              id={`unsupported-reason-${investmentAssetId}`}
              name="unsupportedReason"
              label="Why is this unsupported?"
              required
              placeholder="e.g. debt mutual fund, unlisted shares, received via ESOP"
              error={
                state.status === "error"
                  ? state.fieldErrors?.unsupportedReason
                  : undefined
              }
            />
          ) : null}
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          <SubmitButton pendingText="Saving…" variant="outline" className="w-fit">
            Save classification
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
