"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_GOAL_ACTION_STATE } from "@/lib/goals/action-state";
import {
  recordGoalContributionAllocationAction,
  recordGoalContributionTransferAction,
} from "@/lib/goals/actions";

type GoalContributionFormsProps = {
  goalId: string;
  hasLinkedWallet: boolean;
  accounts: { id: string; name: string }[];
  allocationIdempotencyKey: string;
  transferIdempotencyKey: string;
};

const DIRECTION_OPTIONS = [
  { value: "contribution", label: "Contribution (add)" },
  { value: "withdrawal", label: "Withdrawal (remove)" },
];

export function GoalContributionForms({
  goalId,
  hasLinkedWallet,
  accounts,
  allocationIdempotencyKey,
  transferIdempotencyKey,
}: Readonly<GoalContributionFormsProps>) {
  const [allocationState, allocationAction] = useActionState(
    recordGoalContributionAllocationAction,
    INITIAL_GOAL_ACTION_STATE,
  );
  const [transferState, transferAction] = useActionState(
    recordGoalContributionTransferAction,
    INITIAL_GOAL_ACTION_STATE,
  );

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Earmark existing money</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Marks money you already have as counting toward this goal. Creates
            no transaction — never moves real money.
            {hasLinkedWallet ? " Also updates the linked purpose wallet." : ""}
          </p>
          <form
            action={allocationAction}
            noValidate
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="goalId" value={goalId} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={allocationIdempotencyKey}
            />
            <Select
              id="allocation-direction"
              name="direction"
              label="Direction"
              options={DIRECTION_OPTIONS}
              defaultValue="contribution"
              required
            />
            <Field
              id="allocation-amount"
              name="amount"
              label="Amount"
              required
              inputMode="decimal"
              error={
                allocationState.status === "error"
                  ? allocationState.fieldErrors?.amount
                  : undefined
              }
            />
            {allocationState.status === "error" ? (
              <FormMessage message={allocationState.message} tone="error" />
            ) : null}
            {allocationState.status === "success" ? (
              <FormMessage message={allocationState.message} tone="success" />
            ) : null}
            <SubmitButton pendingText="Recording…">Record</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Move real money</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Transfers actual money between two of your accounts and links the
            transfer to this goal.
          </p>
          {accounts.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              You need at least two accounts to record a transfer.
            </p>
          ) : (
            <form
              action={transferAction}
              noValidate
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="goalId" value={goalId} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={transferIdempotencyKey}
              />
              <Select
                id="transfer-from-account"
                name="fromAccountId"
                label="From account"
                options={accountOptions}
                placeholder="Choose an account"
                required
                error={
                  transferState.status === "error"
                    ? transferState.fieldErrors?.fromAccountId
                    : undefined
                }
              />
              <Select
                id="transfer-to-account"
                name="toAccountId"
                label="To account"
                options={accountOptions}
                placeholder="Choose an account"
                required
                error={
                  transferState.status === "error"
                    ? transferState.fieldErrors?.toAccountId
                    : undefined
                }
              />
              <Field
                id="transfer-amount"
                name="amount"
                label="Amount"
                required
                inputMode="decimal"
                error={
                  transferState.status === "error"
                    ? transferState.fieldErrors?.amount
                    : undefined
                }
              />
              <Field
                id="transfer-occurred-on"
                name="occurredOn"
                label="Date"
                type="date"
                required
                error={
                  transferState.status === "error"
                    ? transferState.fieldErrors?.occurredOn
                    : undefined
                }
              />
              {transferState.status === "error" ? (
                <FormMessage message={transferState.message} tone="error" />
              ) : null}
              {transferState.status === "success" ? (
                <FormMessage message={transferState.message} tone="success" />
              ) : null}
              <SubmitButton pendingText="Recording…">
                Record transfer
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
