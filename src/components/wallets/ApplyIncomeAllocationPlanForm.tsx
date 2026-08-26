"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_WALLET_ACTION_STATE } from "@/lib/wallets/action-state";
import { applyIncomeAllocationPlanToTransactionAction } from "@/lib/wallets/actions";

type ApplyIncomeAllocationPlanFormProps = {
  transactionId: string;
  plans: { id: string; name: string }[];
  alreadyAppliedPlanNames: string[];
};

/** Applies a saved income-allocation plan to this one posted income transaction — idempotent per (plan, transaction) at the database layer. */
export function ApplyIncomeAllocationPlanForm({
  transactionId,
  plans,
  alreadyAppliedPlanNames,
}: Readonly<ApplyIncomeAllocationPlanFormProps>) {
  const [state, formAction] = useActionState(
    applyIncomeAllocationPlanToTransactionAction,
    INITIAL_WALLET_ACTION_STATE,
  );

  if (plans.length === 0) {
    return null;
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="transactionId" value={transactionId} />
      <Select
        id="apply-plan"
        name="planId"
        label="Allocate this income using a plan"
        options={plans.map((p) => ({ value: p.id, label: p.name }))}
        placeholder="No plan"
        error={state.status === "error" ? state.fieldErrors?.planId : undefined}
      />
      {alreadyAppliedPlanNames.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Already applied: {alreadyAppliedPlanNames.join(", ")}
        </p>
      ) : null}
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      {state.status === "success" ? (
        <FormMessage message={state.message} tone="success" />
      ) : null}
      <SubmitButton
        pendingText="Allocating…"
        variant="outline"
        className="w-fit"
      >
        Apply plan
      </SubmitButton>
    </form>
  );
}
