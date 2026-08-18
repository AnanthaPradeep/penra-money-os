"use client";

import { useActionState, useState } from "react";

import { AddInstitutionForm } from "@/components/institutions/AddInstitutionForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_ACCOUNT_ACTION_STATE } from "@/lib/accounts/action-state";
import { createAccountAction } from "@/lib/accounts/actions";
import {
  ACCOUNT_TYPE_LABELS,
  USER_ACCOUNT_TYPES,
  isCreditCardType,
  type UserAccountType,
} from "@/lib/accounts/classes";
import type { Institution } from "@/lib/institutions/mapping";
import { isOneOf } from "@/lib/types/literal";

const ACCOUNT_TYPE_OPTIONS = USER_ACCOUNT_TYPES.map((type) => ({
  value: type,
  label: ACCOUNT_TYPE_LABELS[type],
}));

type AccountFormProps = {
  institutions: Institution[];
};

export function AccountForm({ institutions }: Readonly<AccountFormProps>) {
  const [state, formAction] = useActionState(
    createAccountAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  const [accountType, setAccountType] = useState<UserAccountType | "">("");

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const institutionOptions = institutions.map((institution) => ({
    value: institution.id,
    label: institution.name,
  }));

  const showCreditLimit = isCreditCardType(accountType || "other_asset");

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Account type</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Select
            id="account-type"
            name="accountType"
            label="Account type"
            options={ACCOUNT_TYPE_OPTIONS}
            placeholder="Choose a type"
            required
            error={fieldError("accountType")}
            onChange={(event) => {
              const { value } = event.target;
              if (isOneOf(value, USER_ACCOUNT_TYPES)) {
                setAccountType(value);
              }
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Account identity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Field
            id="account-name"
            name="name"
            label="Account name"
            required
            placeholder="e.g. HDFC Savings"
            error={fieldError("name")}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Currency
            </span>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">INR</span> — this
              personal version supports Indian Rupees only.
            </p>
          </div>
          <input type="hidden" name="currency" value="INR" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Institution</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Select
            id="account-institution"
            name="institutionId"
            label="Institution"
            options={institutionOptions}
            placeholder="No institution"
            description="Optional — useful for cash or wallet accounts without one."
            error={fieldError("institutionId")}
          />
          <AddInstitutionForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Field
            id="account-last-four"
            name="lastFour"
            label="Last 4 digits"
            description="Only the last 4 digits, if you'd like a way to recognise the account. Never the full account or card number."
            inputMode="numeric"
            error={fieldError("lastFour")}
          />
          {showCreditLimit ? (
            <Field
              id="account-credit-limit"
              name="creditLimit"
              label="Credit limit"
              inputMode="decimal"
              description="Used to show your credit utilisation on the account page."
              error={fieldError("creditLimit")}
            />
          ) : null}
          <Field
            id="account-opened-on"
            name="openedOn"
            label="Opened on"
            type="date"
            description="Optional — when this account was actually opened."
            error={fieldError("openedOn")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Opening balance</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Field
            id="account-opening-balance"
            name="openingBalance"
            label="Opening balance"
            inputMode="decimal"
            description="What this account was worth (asset) or what you owed (liability) when it was opened. Leave blank to start from zero — this posts a balanced opening transaction against your Opening Balance Equity account."
            error={fieldError("openingBalance")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="account-notes"
              className="text-sm font-medium text-foreground"
            >
              Notes (optional)
            </label>
            <textarea
              id="account-notes"
              name="notes"
              rows={3}
              aria-invalid={fieldError("notes") ? true : undefined}
              className="flex w-full min-w-0 rounded-md border border-input-border bg-background px-3 py-2 text-base text-foreground transition-colors placeholder:text-muted-foreground aria-invalid:border-negative sm:text-sm"
            />
            {fieldError("notes") ? (
              <p role="alert" className="text-sm font-medium text-negative">
                {fieldError("notes")}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">Create account</SubmitButton>
    </form>
  );
}
