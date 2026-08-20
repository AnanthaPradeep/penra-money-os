"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, useState } from "react";

import type { InvestmentAccountOption } from "@/components/investments/types";
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
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { matureFixedDepositAction } from "@/lib/investments/actions";
import { formatINR } from "@/lib/money/format";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

type MatureFixedDepositDialogProps = {
  holdingId: string;
  accounts: InvestmentAccountOption[];
  expectedMaturityAmount: string | null;
  idempotencyKey: string;
};

/** Marks a fixed deposit or recurring deposit matured — atomically posts principal + interest (see mature_fixed_deposit, supabase/migrations). The actual amount received is entered here; it is never assumed to equal the expected estimate. */
export function MatureFixedDepositDialog({
  holdingId,
  accounts,
  expectedMaturityAmount,
  idempotencyKey,
}: Readonly<MatureFixedDepositDialogProps>) {
  const [state, formAction] = useActionState(
    matureFixedDepositAction,
    INITIAL_INVESTMENT_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Mark matured
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark this matured?</DialogTitle>
          <DialogDescription>
            Posts the principal and interest received as one balanced
            transaction. This can only be done once — enter the actual amount
            received, not the expected estimate.
            {expectedMaturityAmount ? (
              <>
                {" "}
                Expected:{" "}
                <span className="font-medium text-foreground">
                  {formatINR(expectedMaturityAmount)}
                </span>
                .
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="holdingId" value={holdingId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <Select
            id="mature-receiving-account"
            name="receivingAccountId"
            label="Received into"
            options={accountOptions}
            placeholder="Choose an account"
            required
            error={
              state.status === "error"
                ? state.fieldErrors?.receivingAccountId
                : undefined
            }
          />
          <Field
            id="mature-actual-amount"
            name="actualMaturityAmount"
            label="Actual amount received"
            inputMode="decimal"
            required
            error={
              state.status === "error"
                ? state.fieldErrors?.actualMaturityAmount
                : undefined
            }
          />
          <Field
            id="mature-date"
            name="maturityDate"
            label="Maturity date"
            type="date"
            defaultValue={nowAsIstCalendarDate()}
            required
            error={
              state.status === "error"
                ? state.fieldErrors?.maturityDate
                : undefined
            }
          />
          <Field
            id="mature-notes"
            name="notes"
            label="Notes (optional)"
            error={
              state.status === "error" ? state.fieldErrors?.notes : undefined
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
            <SubmitButton pendingText="Recording…" className="sm:w-auto">
              Confirm maturity
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
