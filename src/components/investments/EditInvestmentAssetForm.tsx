"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { updateInvestmentAssetAction } from "@/lib/investments/actions";
import type { InvestmentAsset } from "@/lib/investments/mapping";

type EditInvestmentAssetFormProps = {
  asset: InvestmentAsset;
};

/** Manual-invocation pattern (not useActionState + effect) — avoids react-hooks/set-state-in-effect the same way RecurringItemEditForm does, since this is a self-contained, no-parent-managed-dialog form. */
export function EditInvestmentAssetForm({
  asset,
}: Readonly<EditInvestmentAssetFormProps>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const formData = new FormData(event.currentTarget);
    formData.set("assetId", asset.id);
    const result = await updateInvestmentAssetAction(
      INITIAL_INVESTMENT_ACTION_STATE,
      formData,
    );
    setPending(false);
    if (result.status === "error") {
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field
        id="edit-asset-display-name"
        name="displayName"
        label="Name"
        defaultValue={asset.displayName}
        required
        error={fieldErrors.displayName}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="edit-asset-symbol"
          name="symbol"
          label="Symbol"
          defaultValue={asset.symbol ?? ""}
          error={fieldErrors.symbol}
        />
        <Field
          id="edit-asset-exchange"
          name="exchange"
          label="Exchange"
          defaultValue={asset.exchange ?? ""}
          error={fieldErrors.exchange}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="edit-asset-isin"
          name="isin"
          label="ISIN"
          defaultValue={asset.isin ?? ""}
          error={fieldErrors.isin}
        />
        <Field
          id="edit-asset-scheme-code"
          name="schemeCode"
          label="Scheme code"
          defaultValue={asset.schemeCode ?? ""}
          error={fieldErrors.schemeCode}
        />
      </div>
      <Field
        id="edit-asset-notes"
        name="notes"
        label="Notes"
        defaultValue={asset.notes ?? ""}
        error={fieldErrors.notes}
      />

      {error ? <FormMessage message={error} tone="error" /> : null}

      <Button type="submit" isLoading={pending} className="sm:w-auto">
        Save changes
      </Button>
    </form>
  );
}
