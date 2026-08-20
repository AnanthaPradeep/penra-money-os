"use client";

import { useActionState } from "react";

import type { InvestmentAccountOption } from "@/components/investments/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { createPpfAccountAction } from "@/lib/investments/actions";
import { formatINR } from "@/lib/money/format";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

type PpfFormProps = {
  investmentAccounts: InvestmentAccountOption[];
  fundingAccounts: InvestmentAccountOption[];
  openingContributionIdempotencyKey: string;
};

/** Creates a PPF holding — the interest rate is a user-entered reference figure only, never a hard-coded government rate (see supabase/migrations). An optional opening contribution posts as an asset transfer, never an expense. */
export function PpfForm({
  investmentAccounts,
  fundingAccounts,
  openingContributionIdempotencyKey,
}: Readonly<PpfFormProps>) {
  const [state, formAction] = useActionState(
    createPpfAccountAction,
    INITIAL_INVESTMENT_ACTION_STATE,
  );
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const investmentAccountOptions = investmentAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));
  const fundingAccountOptions = fundingAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input
        type="hidden"
        name="openingContributionIdempotencyKey"
        value={openingContributionIdempotencyKey}
      />
      <Field
        id="ppf-display-name"
        name="displayName"
        label="Name"
        placeholder="e.g. SBI PPF Account"
        required
        error={fieldError("displayName")}
      />
      <Select
        id="ppf-investment-account"
        name="investmentAccountId"
        label="Investment account"
        options={investmentAccountOptions}
        placeholder="Choose an investment account"
        required
        description="Keeps this PPF's contributions/withdrawals reconciled with your ledger."
        error={fieldError("investmentAccountId")}
      />
      <Field
        id="ppf-provider"
        name="provider"
        label="Provider (optional)"
        placeholder="e.g. SBI"
        error={fieldError("provider")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="ppf-start-date"
          name="startDate"
          label="Opened on"
          type="date"
          defaultValue={nowAsIstCalendarDate()}
          required
          error={fieldError("startDate")}
        />
        <Field
          id="ppf-maturity-date"
          name="maturityDate"
          label="Maturity date (optional)"
          type="date"
          error={fieldError("maturityDate")}
        />
      </div>
      <Field
        id="ppf-interest-rate"
        name="interestRate"
        label="Interest rate % (optional, reference only)"
        inputMode="decimal"
        description="What you're currently earning, for your own reference — this app never assumes or updates a government rate for you."
        error={fieldError("interestRate")}
      />
      <Field
        id="ppf-notes"
        name="notes"
        label="Notes (optional)"
        error={fieldError("notes")}
      />

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Opening contribution (optional)
        </legend>
        <Field
          id="ppf-opening-amount"
          name="openingContributionAmount"
          label="Amount"
          inputMode="decimal"
          error={fieldError("openingContributionAmount")}
        />
        <Select
          id="ppf-opening-funding-account"
          name="openingContributionFundingAccountId"
          label="Paid from"
          options={fundingAccountOptions}
          placeholder="Choose an account"
          error={fieldError("openingContributionFundingAccountId")}
        />
      </fieldset>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">Create PPF account</SubmitButton>
    </form>
  );
}
