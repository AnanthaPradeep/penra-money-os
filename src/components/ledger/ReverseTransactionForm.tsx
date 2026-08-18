"use client";

import { RotateCcw } from "lucide-react";
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
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TRANSACTION_ACTION_STATE } from "@/lib/ledger/action-state";
import { reverseTransactionAction } from "@/lib/ledger/actions";

type ReverseTransactionFormProps = {
  transactionId: string;
};

/** A real Radix Dialog (focus-trapped, Escape-to-close) confirming a reversal — never called "delete", since nothing is removed. */
export function ReverseTransactionForm({
  transactionId,
}: Readonly<ReverseTransactionFormProps>) {
  const [state, formAction] = useActionState(
    reverseTransactionAction,
    INITIAL_TRANSACTION_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <RotateCcw aria-hidden="true" className="size-4" />
          Reverse this transaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse this transaction?</DialogTitle>
          <DialogDescription>
            This posts a new, linked transaction with the opposite entries. The
            original is kept and marked as reversed — nothing is deleted, and
            both remain visible in your history.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="transactionId" value={transactionId} />
          <Field id="reversal-reason" name="reason" label="Reason (optional)" />

          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton pendingText="Reversing…" className="sm:w-auto">
              Confirm reversal
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
