"use client";

import { PlusCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_WALLET_ACTION_STATE } from "@/lib/wallets/action-state";
import { createPurposeWalletAction } from "@/lib/wallets/actions";

const FUNDING_MODE_OPTIONS = [
  { value: "earmarked", label: "Earmarked — backed by real money you have" },
  {
    value: "planning_only",
    label: "Planning only — no real money set aside yet",
  },
];

export function CreateWalletDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createPurposeWalletAction,
    INITIAL_WALLET_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle aria-hidden="true" className="size-4" />
          New wallet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a purpose wallet</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          noValidate
          className="mt-4 flex flex-col gap-4"
        >
          <Field
            id="wallet-name"
            name="name"
            label="Name"
            required
            placeholder="e.g. Emergency, Travel, Groceries"
            error={fieldError("name")}
          />
          <Select
            id="wallet-funding-mode"
            name="fundingMode"
            label="Funding mode"
            options={FUNDING_MODE_OPTIONS}
            defaultValue="earmarked"
            required
            description="Earmarked wallets can never be allocated more than your real available balance. Planning-only wallets track a target with no real money backing it yet."
            error={fieldError("fundingMode")}
          />
          <Field
            id="wallet-target-amount"
            name="targetAmount"
            label="Target amount (optional)"
            inputMode="decimal"
            description="How much you'd like this wallet to hold, for progress display only."
            error={fieldError("targetAmount")}
          />
          <Field
            id="wallet-priority"
            name="priority"
            label="Priority (optional)"
            type="number"
            defaultValue={0}
            description="Higher numbers sort first in your wallet list."
            error={fieldError("priority")}
          />
          <input type="hidden" name="currency" value="INR" />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          <SubmitButton pendingText="Creating…">Create wallet</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
