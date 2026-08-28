"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { finalizeTaxReportSnapshotAction } from "@/lib/tax/actions";

export function FinalizeReportForm({
  snapshotId,
  financialYearId,
}: Readonly<{ snapshotId: string; financialYearId: string }>) {
  const [state, formAction] = useActionState(
    finalizeTaxReportSnapshotAction,
    INITIAL_TAX_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Finalize this report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize this report?</DialogTitle>
          <DialogDescription>
            A finalized report becomes immutable — its figures can never be
            edited afterward, only superseded by a new report you generate
            later (the old one stays visible, never deleted). This is still
            not a tax return and is never submitted anywhere.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="snapshotId" value={snapshotId} />
          <input type="hidden" name="financialYearId" value={financialYearId} />
          {state.status === "error" ? (
            <div className="mt-4">
              <FormMessage message={state.message} tone="error" />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Finalizing…" className="sm:w-auto">
              Finalize
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
