"use client";

import { CircleCheck } from "lucide-react";
import { useActionState, useState } from "react";

import type {
  RecurringAccountOption,
  RecurringCategoryOption,
} from "@/components/recurring/types";
import {
  PayeeCombobox,
  type PayeeOption,
} from "@/components/ledger/PayeeCombobox";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_RECURRING_ACTION_STATE } from "@/lib/recurring/action-state";
import { recordOccurrencePaymentAction } from "@/lib/recurring/actions";
import { formatINR } from "@/lib/money/format";

type RecordPaymentDialogProps = {
  occurrenceId: string;
  itemKind: "bill" | "subscription" | "income" | "transfer";
  itemName: string;
  /** Accounts to choose from — ignored for a transfer occurrence, whose accounts are fixed by the recurring item. */
  accounts: RecurringAccountOption[];
  categories: RecurringCategoryOption[];
  payees: PayeeOption[];
  defaultAccountId: string | null;
  defaultCategoryId: string | null;
  defaultPayeeId: string | null;
  defaultAmount: string;
  defaultDate: string;
  /** Transfer only: both accounts are fixed by the item, never user-editable here. */
  transferSourceAccount?: { id: string; name: string } | undefined;
  transferDestinationAccount?: { id: string; name: string } | undefined;
};

/**
 * Prefilled composer for a due reminder-only occurrence's payment, posted
 * through post_occurrence_payment (see recordOccurrencePaymentAction, src/
 * lib/recurring/actions.ts) — the exact same entry-builder helpers the
 * regular transaction forms use, never a separate, weaker posting path.
 */
export function RecordPaymentDialog({
  occurrenceId,
  itemKind,
  itemName,
  accounts,
  categories,
  payees,
  defaultAccountId,
  defaultCategoryId,
  defaultPayeeId,
  defaultAmount,
  defaultDate,
  transferSourceAccount,
  transferDestinationAccount,
}: Readonly<RecordPaymentDialogProps>) {
  const [state, formAction] = useActionState(
    recordOccurrencePaymentAction,
    INITIAL_RECURRING_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));
  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));
  const defaultPayee = defaultPayeeId
    ? payees.find((p) => p.id === defaultPayeeId)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <CircleCheck aria-hidden="true" className="size-4" />
          Record payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment for &ldquo;{itemName}&rdquo;</DialogTitle>
        </DialogHeader>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="occurrenceId" value={occurrenceId} />
          <input type="hidden" name="itemKind" value={itemKind} />

          {itemKind === "transfer" &&
          transferSourceAccount &&
          transferDestinationAccount ? (
            <>
              <input
                type="hidden"
                name="sourceAccountId"
                value={transferSourceAccount.id}
              />
              <input
                type="hidden"
                name="destinationAccountId"
                value={transferDestinationAccount.id}
              />
              <p className="text-sm text-muted-foreground">
                {transferSourceAccount.name} &rarr;{" "}
                {transferDestinationAccount.name}
              </p>
            </>
          ) : (
            <Select
              id="record-payment-account"
              name="accountId"
              label={itemKind === "income" ? "Received into" : "Paid from"}
              options={accountOptions}
              defaultValue={defaultAccountId ?? undefined}
              placeholder="Choose an account"
              required
              error={fieldError("accountId")}
            />
          )}

          <Field
            id="record-payment-amount"
            name="amount"
            label="Amount"
            inputMode="decimal"
            defaultValue={defaultAmount}
            required
            error={fieldError("amount")}
          />
          <Field
            id="record-payment-date"
            name="occurredOn"
            label="Date"
            type="date"
            defaultValue={defaultDate}
            required
            error={fieldError("occurredOn")}
          />

          {itemKind !== "transfer" ? (
            <>
              <Select
                id="record-payment-category"
                name="categoryId"
                label="Category"
                options={categoryOptions}
                defaultValue={defaultCategoryId ?? undefined}
                placeholder="Choose a category"
                error={fieldError("categoryId")}
              />
              <PayeeCombobox
                payees={payees}
                name="payeeId"
                label={
                  itemKind === "income"
                    ? "Payer (optional)"
                    : "Payee (optional)"
                }
                defaultPayee={defaultPayee}
              />
            </>
          ) : null}

          <Field
            id="record-payment-notes"
            name="notes"
            label="Notes (optional)"
          />

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
            <SubmitButton pendingText="Recording…" className="sm:w-auto">
              Record payment
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
