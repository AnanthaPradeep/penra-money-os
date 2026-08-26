"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_BANK_IMPORT_ACTION_STATE } from "@/lib/bank-import/action-state";
import { markImportReadyAction } from "@/lib/bank-import/actions";

export function MarkImportReadyButton({
  importId,
}: Readonly<{ importId: string }>) {
  const [state, formAction] = useActionState(
    markImportReadyAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="importId" value={importId} />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton className="w-fit" pendingText="Marking ready…">
        Mark ready to reconcile
      </SubmitButton>
    </form>
  );
}
