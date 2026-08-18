"use client";

import { Archive } from "lucide-react";
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
import { archiveAccountAction } from "@/lib/accounts/actions";
import { INITIAL_ACCOUNT_ACTION_STATE } from "@/lib/accounts/action-state";

type ArchiveAccountFormProps = {
  accountId: string;
  accountName: string;
};

/**
 * A real Radix Dialog (focus-trapped, Escape-to-close) wrapping the actual
 * Server Action form — archiving is reversible in the sense that nothing
 * financial is deleted, but it does change what the user sees by default,
 * so it gets the same confirm-before-acting treatment as reversal.
 */
export function ArchiveAccountForm({
  accountId,
  accountName,
}: Readonly<ArchiveAccountFormProps>) {
  const [state, formAction] = useActionState(
    archiveAccountAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Archive aria-hidden="true" className="size-4" />
          Archive account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {accountName}?</DialogTitle>
          <DialogDescription>
            Archiving hides this account from your default account list. It is
            not deleted — every transaction and balance in its history stays
            exactly as it is, and you can find it again later under Archived.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="accountId" value={accountId} />
          {state.status === "error" ? (
            <div className="mt-4">
              <FormMessage message={state.message} tone="error" />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton pendingText="Archiving…" className="sm:w-auto">
              Archive account
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
