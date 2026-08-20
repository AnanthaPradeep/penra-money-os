"use client";

import { CircleDollarSign } from "lucide-react";
import { useActionState, useState } from "react";

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
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { addInvestmentValuationAction } from "@/lib/investments/actions";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

type AddValuationFormProps = {
  holdingId: string;
};

/** Adds a new, dated manual valuation — never edits or replaces an earlier one (see add_investment_valuation, supabase/migrations). Always labelled "manual" in the UI, never live/market. */
export function AddValuationForm({
  holdingId,
}: Readonly<AddValuationFormProps>) {
  const [state, formAction] = useActionState(
    addInvestmentValuationAction,
    INITIAL_INVESTMENT_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <CircleDollarSign aria-hidden="true" className="size-4" />
          Add manual valuation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a manual valuation</DialogTitle>
        </DialogHeader>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="holdingId" value={holdingId} />
          <p className="text-sm text-muted-foreground">
            A dated estimate you enter yourself — never a live market price.
            Adding a new valuation never overwrites an earlier one.
          </p>
          <Field
            id="valuation-valued-at"
            name="valuedAt"
            label="As of date"
            type="date"
            defaultValue={nowAsIstCalendarDate()}
            required
            error={
              state.status === "error" ? state.fieldErrors?.valuedAt : undefined
            }
          />
          <Field
            id="valuation-total-value"
            name="totalValue"
            label="Total value"
            inputMode="decimal"
            required
            error={
              state.status === "error"
                ? state.fieldErrors?.totalValue
                : undefined
            }
          />
          <Field
            id="valuation-unit-value"
            name="unitValue"
            label="Unit value (optional)"
            inputMode="decimal"
            error={
              state.status === "error"
                ? state.fieldErrors?.unitValue
                : undefined
            }
          />
          <Field
            id="valuation-note"
            name="note"
            label="Note (optional)"
            error={
              state.status === "error" ? state.fieldErrors?.note : undefined
            }
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
              Save valuation
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
