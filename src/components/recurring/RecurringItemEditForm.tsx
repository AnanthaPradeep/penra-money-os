"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { RecurrenceScheduleFields } from "@/components/recurring/RecurrenceScheduleFields";
import type { RecurringCategoryOption } from "@/components/recurring/types";
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
import { INITIAL_RECURRING_ACTION_STATE } from "@/lib/recurring/action-state";
import type { RecurringActionState } from "@/lib/recurring/action-state";
import { updateRecurringItemAction } from "@/lib/recurring/actions";
import type { RecurringItem } from "@/lib/recurring/mapping";

type RecurringItemEditFormProps = {
  item: RecurringItem;
  categories: RecurringCategoryOption[] | null;
  payees: PayeeOption[];
  defaultPayee: PayeeOption | undefined;
};

/**
 * Edits amount/category/payee/notes/end date/frequency/interval/
 * processing mode — kind, accounts, currency, and start date are fixed
 * (see update_recurring_item, supabase/migrations). categories === null
 * for a transfer, which has no category field at all. Calls the Server
 * Action directly (rather than through useActionState) so the dialog can
 * close and the page can refresh right after a successful save, without
 * doing that state update inside an effect.
 */
export function RecurringItemEditForm({
  item,
  categories,
  payees,
  defaultPayee,
}: Readonly<RecurringItemEditFormProps>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<RecurringActionState>(
    INITIAL_RECURRING_ACTION_STATE,
  );
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const result = await updateRecurringItemAction(state, formData);
    setPending(false);
    setState(result);
    if (result.status === "success") {
      router.refresh();
      setOpen(false);
    }
  }

  const categoryOptions = (categories ?? []).map((category) => ({
    value: category.id,
    label: category.name,
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit &ldquo;{item.name}&rdquo;</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="recurringItemId" value={item.id} />
          <Field
            id="edit-recurring-name"
            name="name"
            label="Name"
            defaultValue={item.name}
            required
            error={fieldError("name")}
          />
          <Field
            id="edit-recurring-amount"
            name="amount"
            label="Amount"
            inputMode="decimal"
            defaultValue={item.amount.toString()}
            required
            error={fieldError("amount")}
          />
          {categories !== null ? (
            <Select
              id="edit-recurring-category"
              name="categoryId"
              label="Category"
              options={categoryOptions}
              defaultValue={item.categoryId ?? undefined}
              placeholder="Choose a category"
              error={fieldError("categoryId")}
            />
          ) : null}
          {categories !== null ? (
            <PayeeCombobox
              payees={payees}
              name="payeeId"
              label="Payee (optional)"
              defaultPayee={defaultPayee}
            />
          ) : null}
          <RecurrenceScheduleFields
            idPrefix="edit-recurring"
            fieldError={fieldError}
            defaultFrequency={item.frequency}
            defaultIntervalCount={item.intervalCount}
            defaultEndDate={item.endDate ?? undefined}
            defaultProcessingMode={item.processingMode}
            showStartDate={false}
          />
          <Field
            id="edit-recurring-notes"
            name="notes"
            label="Notes (optional)"
            defaultValue={item.notes ?? undefined}
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
            <Button
              type="submit"
              className="sm:w-auto"
              disabled={pending}
              isLoading={pending}
            >
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
