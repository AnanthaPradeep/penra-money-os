"use client";

import { Link2 } from "lucide-react";
import { useActionState, useState } from "react";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { INITIAL_RECURRING_ACTION_STATE } from "@/lib/recurring/action-state";
import { linkExistingTransactionAction } from "@/lib/recurring/actions";
import type { LinkableTransaction } from "@/lib/recurring/queries";

type LinkExistingTransactionDialogProps = {
  occurrenceId: string;
  candidates: LinkableTransaction[];
};

/**
 * Lets the user link a due occurrence to a transaction they already
 * entered, instead of recording a new one — validated (ownership, kind,
 * currency, not already linked) server-side by link_existing_transaction_
 * to_occurrence regardless of what appears in this list.
 */
export function LinkExistingTransactionDialog({
  occurrenceId,
  candidates,
}: Readonly<LinkExistingTransactionDialogProps>) {
  const [state, formAction] = useActionState(
    linkExistingTransactionAction,
    INITIAL_RECURRING_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Link2 aria-hidden="true" className="size-4" />
          Link existing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link an existing transaction</DialogTitle>
        </DialogHeader>

        {candidates.length === 0 ? (
          <EmptyState
            title="No compatible transactions"
            description="Transactions you've already recorded that match this item's kind and aren't linked elsewhere will show up here."
          />
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="occurrenceId" value={occurrenceId} />
            <input
              type="hidden"
              name="transactionId"
              value={selectedId ?? ""}
            />
            <ul
              role="listbox"
              aria-label="Compatible transactions"
              className="flex max-h-72 flex-col gap-2 overflow-y-auto"
            >
              {candidates.map((transaction) => (
                <li key={transaction.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedId === transaction.id}
                    onClick={() => setSelectedId(transaction.id)}
                    className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      selectedId === transaction.id
                        ? "border-primary bg-muted-surface"
                        : "border-border hover:border-input-border"
                    }`}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium text-foreground">
                        {transaction.description}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {transaction.accountName} &middot;{" "}
                        {formatIstDateTime(transaction.occurredAt)}
                      </span>
                    </span>
                    <AmountDisplay value={transaction.amount} size="sm" />
                  </button>
                </li>
              ))}
            </ul>

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
              <SubmitButton
                pendingText="Linking…"
                className="sm:w-auto"
                disabled={!selectedId}
              >
                Link transaction
              </SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
