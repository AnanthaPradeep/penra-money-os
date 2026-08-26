"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_DEBT_ACTION_STATE } from "@/lib/debts/action-state";
import {
  changeDebtRateAction,
  regenerateDebtPaymentScheduleAction,
  setDebtStatusAction,
} from "@/lib/debts/actions";
import { DEBT_STATUSES, type DebtStatus } from "@/lib/debts/mapping";

const STATUS_OPTIONS = DEBT_STATUSES.map((s) => ({ value: s, label: s }));

export function DebtStatusForm({
  debtId,
  status,
}: Readonly<{ debtId: string; status: DebtStatus }>) {
  const [, formAction] = useActionState(
    setDebtStatusAction,
    INITIAL_DEBT_ACTION_STATE,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="debtId" value={debtId} />
      <div className="w-40">
        <Select
          id="debt-status"
          name="status"
          label="Status"
          options={STATUS_OPTIONS}
          defaultValue={status}
        />
      </div>
      <SubmitButton pendingText="Updating…" variant="outline" className="w-fit">
        Update status
      </SubmitButton>
    </form>
  );
}

export function ChangeDebtRateForm({ debtId }: Readonly<{ debtId: string }>) {
  const [state, formAction] = useActionState(
    changeDebtRateAction,
    INITIAL_DEBT_ACTION_STATE,
  );

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Change interest rate</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="debtId" value={debtId} />
          <Field
            id="rate-new-rate"
            name="annualInterestRate"
            label="New annual rate (%)"
            required
            inputMode="decimal"
            error={
              state.status === "error"
                ? state.fieldErrors?.annualInterestRate
                : undefined
            }
          />
          <Field
            id="rate-effective-date"
            name="effectiveDate"
            label="Effective from"
            type="date"
            required
            error={
              state.status === "error"
                ? state.fieldErrors?.effectiveDate
                : undefined
            }
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Updating…" variant="outline">
            Update rate
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function RegenerateScheduleForm({
  debtId,
}: Readonly<{ debtId: string }>) {
  const [state, formAction] = useActionState(
    regenerateDebtPaymentScheduleAction,
    INITIAL_DEBT_ACTION_STATE,
  );

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Generate payment schedule</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Only replaces future, unpaid installments — anything already paid
          stays exactly as it was.
        </p>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="debtId" value={debtId} />
          <Field
            id="schedule-installment-count"
            name="installmentCount"
            label="Number of installments"
            required
            inputMode="numeric"
            error={
              state.status === "error"
                ? state.fieldErrors?.installmentCount
                : undefined
            }
          />
          <Field
            id="schedule-installment-payment"
            name="installmentPayment"
            label="Installment amount (optional)"
            inputMode="decimal"
            description="Leave blank for a standard EMI to be calculated for you."
            error={
              state.status === "error"
                ? state.fieldErrors?.installmentPayment
                : undefined
            }
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Generating…" variant="outline">
            Generate schedule
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
