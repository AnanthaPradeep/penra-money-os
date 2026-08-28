"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { generateTaxReportSnapshotAction } from "@/lib/tax/actions";

export function GenerateReportForm({
  financialYearId,
}: Readonly<{ financialYearId: string }>) {
  const [state, formAction] = useActionState(
    generateTaxReportSnapshotAction,
    INITIAL_TAX_ACTION_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="financialYearId" value={financialYearId} />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      {state.status === "success" ? (
        <FormMessage message={state.message} tone="success" />
      ) : null}
      <SubmitButton pendingText="Generating…" className="w-fit">
        Generate draft report
      </SubmitButton>
    </form>
  );
}
