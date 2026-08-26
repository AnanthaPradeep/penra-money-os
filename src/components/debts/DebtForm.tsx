"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_DEBT_ACTION_STATE } from "@/lib/debts/action-state";
import { createDebtAction } from "@/lib/debts/actions";
import {
  DEBT_PAYMENT_FREQUENCIES,
  DEBT_TYPES,
  DEBT_TYPE_LABELS,
} from "@/lib/debts/mapping";

const DEBT_TYPE_OPTIONS = DEBT_TYPES.map((t) => ({
  value: t,
  label: DEBT_TYPE_LABELS[t],
}));

const INTEREST_METHOD_OPTIONS = [
  { value: "reducing_balance", label: "Reducing balance (standard EMI)" },
  { value: "flat_rate", label: "Flat rate" },
  {
    value: "manual_schedule",
    label: "Manual schedule (no auto-generated EMI)",
  },
];

const FREQUENCY_OPTIONS = DEBT_PAYMENT_FREQUENCIES.map((f) => ({
  value: f,
  label: f.replace("_", "-"),
}));

type DebtFormProps = {
  liabilityAccounts: { id: string; name: string }[];
};

export function DebtForm({ liabilityAccounts }: Readonly<DebtFormProps>) {
  const [state, formAction] = useActionState(
    createDebtAction,
    INITIAL_DEBT_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  if (liabilityAccounts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground">
          Create a liability account (credit card, loan, or other liability)
          before adding a debt — every debt is linked to exactly one.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Debt details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Field
            id="debt-name"
            name="name"
            label="Name"
            required
            placeholder="e.g. Home loan, Car EMI"
            error={fieldError("name")}
          />
          <Select
            id="debt-type"
            name="debtType"
            label="Debt type"
            options={DEBT_TYPE_OPTIONS}
            required
            placeholder="Choose a type"
            error={fieldError("debtType")}
          />
          <Select
            id="debt-liability-account"
            name="liabilityAccountId"
            label="Liability account"
            options={liabilityAccounts.map((a) => ({
              value: a.id,
              label: a.name,
            }))}
            placeholder="Choose an account"
            required
            description="Each debt maps to exactly one liability account."
            error={fieldError("liabilityAccountId")}
          />
          <input type="hidden" name="currency" value="INR" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Terms</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Field
            id="debt-original-principal"
            name="originalPrincipal"
            label="Original principal"
            required
            inputMode="decimal"
            error={fieldError("originalPrincipal")}
          />
          <Field
            id="debt-start-date"
            name="startDate"
            label="Start date"
            type="date"
            required
            error={fieldError("startDate")}
          />
          <Field
            id="debt-annual-rate"
            name="annualInterestRate"
            label="Annual interest rate (%)"
            inputMode="decimal"
            description="Enter 0 for an interest-free debt. Never assumed — you enter the actual rate."
            error={fieldError("annualInterestRate")}
          />
          <Select
            id="debt-interest-method"
            name="interestMethod"
            label="Interest method"
            options={INTEREST_METHOD_OPTIONS}
            defaultValue="reducing_balance"
            error={fieldError("interestMethod")}
          />
          <Select
            id="debt-payment-frequency"
            name="paymentFrequency"
            label="Payment frequency"
            options={FREQUENCY_OPTIONS}
            defaultValue="monthly"
            error={fieldError("paymentFrequency")}
          />
          <Field
            id="debt-contractual-end-date"
            name="contractualEndDate"
            label="Contractual end date (optional)"
            type="date"
            error={fieldError("contractualEndDate")}
          />
          <Field
            id="debt-minimum-payment"
            name="minimumPayment"
            label="Minimum/EMI payment (optional)"
            inputMode="decimal"
            description="Used to generate an amortization schedule if left blank a standard EMI is calculated for you."
            error={fieldError("minimumPayment")}
          />
          <Field
            id="debt-due-day"
            name="dueDay"
            label="Due day of month (optional)"
            inputMode="numeric"
            error={fieldError("dueDay")}
          />
        </CardContent>
      </Card>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">Create debt</SubmitButton>
    </form>
  );
}
