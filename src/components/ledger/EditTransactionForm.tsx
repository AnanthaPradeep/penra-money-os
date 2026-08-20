"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";

import {
  PayeeCombobox,
  type PayeeOption,
} from "@/components/ledger/PayeeCombobox";
import type { CategoryOption } from "@/components/ledger/types";
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
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TRANSACTION_ACTION_STATE } from "@/lib/ledger/action-state";
import { editTransactionAction } from "@/lib/ledger/actions";

type EditTransactionFormProps = {
  transactionId: string;
  defaultAmount: string;
  defaultOccurredOn: string;
  defaultDescription: string;
  defaultNotes: string | null;
  categories: CategoryOption[] | null;
  defaultCategoryId: string | null;
  payees: PayeeOption[];
  defaultPayee: PayeeOption | null;
};

/**
 * Same real-Dialog pattern as ReverseTransactionForm. `categories` is
 * `null` for transfer/credit_card_payment (which never have a category —
 * see validate_ledger_transaction_refs), so the field is simply omitted
 * for those types rather than shown empty.
 */
export function EditTransactionForm({
  transactionId,
  defaultAmount,
  defaultOccurredOn,
  defaultDescription,
  defaultNotes,
  categories,
  defaultCategoryId,
  payees,
  defaultPayee,
}: Readonly<EditTransactionFormProps>) {
  const [state, formAction] = useActionState(
    editTransactionAction,
    INITIAL_TRANSACTION_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct this transaction</DialogTitle>
          <DialogDescription>
            This reverses the original and posts a corrected replacement — both
            stay visible in your history. The accounts involved can&apos;t be
            changed here; for that, reverse this one and record a new
            transaction instead.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="transactionId" value={transactionId} />
          <Field
            id="edit-amount"
            name="amount"
            label="Amount"
            inputMode="decimal"
            defaultValue={defaultAmount}
            required
            error={fieldError("amount")}
          />
          <Field
            id="edit-date"
            name="occurredOn"
            label="Date"
            type="date"
            defaultValue={defaultOccurredOn}
            required
            error={fieldError("occurredOn")}
          />
          <Field
            id="edit-description"
            name="description"
            label="Description"
            defaultValue={defaultDescription}
            required
            error={fieldError("description")}
          />
          {categories ? (
            <Select
              id="edit-category"
              name="categoryId"
              label="Category"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              defaultValue={defaultCategoryId ?? undefined}
              placeholder="Choose a category"
              error={fieldError("categoryId")}
            />
          ) : null}
          <PayeeCombobox
            payees={payees}
            name="payeeId"
            label="Payee (optional)"
            defaultPayee={defaultPayee ?? undefined}
          />
          <Field
            id="edit-notes"
            name="notes"
            label="Notes (optional)"
            defaultValue={defaultNotes ?? undefined}
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
            <SubmitButton pendingText="Saving…" className="sm:w-auto">
              Save correction
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
