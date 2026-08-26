"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormMessage } from "@/components/ui/FormMessage";
import { INITIAL_BANK_IMPORT_ACTION_STATE } from "@/lib/bank-import/action-state";
import { discardImportAction } from "@/lib/bank-import/actions";

export function DiscardImportButton({
  importId,
}: Readonly<{ importId: string }>) {
  const [state, formAction] = useActionState(
    discardImportAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="importId" value={importId} />
      </form>
      <ConfirmDialog
        trigger={
          <Button type="button" variant="destructive">
            Discard import
          </Button>
        }
        title="Discard this import?"
        description="This removes nothing from your ledger — nothing from this import ever posted — but the staged rows will no longer be reviewable."
        confirmLabel="Discard"
        tone="destructive"
        onConfirm={() => {
          formRef.current?.requestSubmit();
        }}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
    </div>
  );
}
