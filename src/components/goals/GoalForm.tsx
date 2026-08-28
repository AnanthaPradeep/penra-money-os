"use client";

import { useActionState, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_GOAL_ACTION_STATE } from "@/lib/goals/action-state";
import { createFinancialGoalAction } from "@/lib/goals/actions";
import {
  GOAL_TYPES,
  GOAL_TYPE_LABELS,
  type GoalType,
} from "@/lib/goals/mapping";

const GOAL_TYPE_OPTIONS = GOAL_TYPES.map((t) => ({
  value: t,
  label: GOAL_TYPE_LABELS[t],
}));

const FUNDING_MODE_OPTIONS = [
  { value: "earmarked", label: "Earmarked — backed by real money you have" },
  {
    value: "planning_only",
    label: "Planning only — no real money set aside yet",
  },
];

const EF_METHOD_OPTIONS = [
  { value: "fixed_amount", label: "A fixed target amount" },
  {
    value: "months_of_expenses",
    label: "A number of months of essential expenses",
  },
];

const SF_FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-yearly" },
  { value: "yearly", label: "Yearly" },
];

type GoalFormProps = {
  wallets: { id: string; name: string }[];
  defaultGoalType?: GoalType;
  expenseCategories?: { id: string; name: string }[];
};

export function GoalForm({
  wallets,
  defaultGoalType,
  expenseCategories = [],
}: Readonly<GoalFormProps>) {
  const [state, formAction] = useActionState(
    createFinancialGoalAction,
    INITIAL_GOAL_ACTION_STATE,
  );
  const [goalType, setGoalType] = useState<GoalType>(
    defaultGoalType ?? "custom",
  );
  const [efMethod, setEfMethod] = useState("fixed_amount");
  const [efExpenseSource, setEfExpenseSource] = useState<"manual" | "categories">(
    "manual",
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const walletOptions = wallets.map((w) => ({ value: w.id, label: w.name }));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Goal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Field
            id="goal-name"
            name="name"
            label="Name"
            required
            placeholder="e.g. Emergency fund, Japan trip"
            error={fieldError("name")}
          />
          {defaultGoalType ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Goal type
              </span>
              <p className="text-sm text-muted-foreground">
                {GOAL_TYPE_LABELS[defaultGoalType]}
              </p>
              <input type="hidden" name="goalType" value={defaultGoalType} />
            </div>
          ) : (
            <Select
              id="goal-type"
              name="goalType"
              label="Goal type"
              options={GOAL_TYPE_OPTIONS}
              defaultValue={goalType}
              required
              onChange={(e) => setGoalType(e.target.value as GoalType)}
              error={fieldError("goalType")}
            />
          )}
          <Field
            id="goal-target-amount"
            name="targetAmount"
            label="Target amount"
            required
            inputMode="decimal"
            error={fieldError("targetAmount")}
          />
          <Field
            id="goal-target-date"
            name="targetDate"
            label="Target date (optional)"
            type="date"
            error={fieldError("targetDate")}
          />
          <Field
            id="goal-priority"
            name="priority"
            label="Priority (optional)"
            type="number"
            defaultValue={0}
            error={fieldError("priority")}
          />
          <input type="hidden" name="currency" value="INR" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Funding</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Select
            id="goal-funding-mode"
            name="fundingMode"
            label="Funding mode"
            options={FUNDING_MODE_OPTIONS}
            defaultValue="earmarked"
            required
            error={fieldError("fundingMode")}
          />
          <Select
            id="goal-purpose-wallet"
            name="purposeWalletId"
            label="Linked purpose wallet (optional)"
            options={walletOptions}
            placeholder="No linked wallet"
            description="An allocation-only contribution to this goal will also earmark the linked wallet by the same amount."
            error={fieldError("purposeWalletId")}
          />
        </CardContent>
      </Card>

      {goalType === "emergency_fund" ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Emergency fund target</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <Select
              id="goal-ef-method"
              name="efTargetMethod"
              label="Target method"
              options={EF_METHOD_OPTIONS}
              defaultValue={efMethod}
              onChange={(e) => setEfMethod(e.target.value)}
              error={fieldError("efTargetMethod")}
            />
            {efMethod === "months_of_expenses" ? (
              <>
                <Field
                  id="goal-ef-months"
                  name="efTargetMonths"
                  label="Months of expenses"
                  inputMode="numeric"
                  error={fieldError("efTargetMonths")}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    How should we set your essential monthly expense?
                  </span>
                  <div className="flex gap-4 text-sm text-foreground">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="ef-expense-source"
                        checked={efExpenseSource === "manual"}
                        onChange={() => setEfExpenseSource("manual")}
                      />
                      I&apos;ll enter it myself
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="ef-expense-source"
                        checked={efExpenseSource === "categories"}
                        onChange={() => setEfExpenseSource("categories")}
                        disabled={expenseCategories.length === 0}
                      />
                      Calculate from categories
                    </label>
                  </div>
                </div>
                {efExpenseSource === "manual" ? (
                  <Field
                    id="goal-ef-expense"
                    name="efEssentialMonthlyExpense"
                    label="Your confirmed essential monthly expense"
                    inputMode="decimal"
                    description="You confirm this figure directly — it is never inferred automatically from your spending history."
                    error={fieldError("efEssentialMonthlyExpense")}
                  />
                ) : (
                  <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                    <span className="text-sm font-medium text-foreground">
                      Essential categories
                    </span>
                    <div className="flex flex-col gap-2">
                      {expenseCategories.map((category) => (
                        <label
                          key={category.id}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          <input
                            type="checkbox"
                            name="efEssentialCategoryIds"
                            value={category.id}
                            className="size-4 rounded border-input-border"
                          />
                          {category.name}
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field
                        id="goal-ef-period-start"
                        name="efEssentialPeriodStart"
                        label="From"
                        type="date"
                        error={fieldError("efEssentialPeriodStart")}
                      />
                      <Field
                        id="goal-ef-period-end"
                        name="efEssentialPeriodEnd"
                        label="To"
                        type="date"
                        error={fieldError("efEssentialPeriodEnd")}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll sum your actual recorded spend in these
                      categories over that period and average it per month —
                      the calculation and source period are always shown on
                      the goal.
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {goalType === "sinking_fund" ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Sinking fund schedule</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Select
              id="goal-sf-frequency"
              name="sfContributionFrequency"
              label="Contribution frequency"
              options={SF_FREQUENCY_OPTIONS}
              defaultValue="monthly"
              error={fieldError("sfContributionFrequency")}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="goal-notes"
              className="text-sm font-medium text-foreground"
            >
              Notes (optional)
            </label>
            <textarea
              id="goal-notes"
              name="notes"
              rows={3}
              className="flex w-full min-w-0 rounded-md border border-input-border bg-background px-3 py-2 text-base text-foreground transition-colors placeholder:text-muted-foreground sm:text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">Create goal</SubmitButton>
    </form>
  );
}
