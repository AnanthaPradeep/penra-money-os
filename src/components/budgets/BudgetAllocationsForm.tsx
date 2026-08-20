"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_BUDGET_ACTION_STATE } from "@/lib/budgets/action-state";
import { saveBudgetAllocationsAction } from "@/lib/budgets/actions";
import type { CategoryBudgetProgress } from "@/lib/budgets/mapping";

type BudgetAllocationsFormProps = {
  budgetPeriodId: string;
  expenseCategories: { id: string; name: string }[];
  existingProgress: CategoryBudgetProgress[];
  defaultPlannedIncome: string;
};

/**
 * One amount input per expense category, named `amount:<categoryId>` —
 * saveBudgetAllocationsAction (src/lib/budgets/actions.ts) reads every
 * field with that prefix, so a variable-length category list needs no
 * client-side array serialization. Submitting replaces every allocation
 * for this period atomically (see save_budget_allocations, supabase/
 * migrations) — a category left blank is saved as a zero-planned
 * allocation, a deliberate "planned nothing yet" state, not the absence
 * of a row.
 */
export function BudgetAllocationsForm({
  budgetPeriodId,
  expenseCategories,
  existingProgress,
  defaultPlannedIncome,
}: Readonly<BudgetAllocationsFormProps>) {
  const [state, formAction] = useActionState(
    saveBudgetAllocationsAction,
    INITIAL_BUDGET_ACTION_STATE,
  );
  const router = useRouter();
  const progressByCategory = new Map(
    existingProgress.map((p) => [p.categoryId, p]),
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="budgetPeriodId" value={budgetPeriodId} />
      <Field
        id="budget-planned-income"
        name="plannedIncome"
        label="Planned income (optional)"
        inputMode="decimal"
        defaultValue={defaultPlannedIncome}
        placeholder="0.00"
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Category allocations
        </legend>
        {expenseCategories.map((category) => (
          <Field
            key={category.id}
            id={`budget-amount-${category.id}`}
            name={`amount:${category.id}`}
            label={category.name}
            inputMode="decimal"
            defaultValue={
              progressByCategory.get(category.id)?.plannedAmount.toString() ??
              "0"
            }
            placeholder="0.00"
          />
        ))}
      </fieldset>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      {state.status === "success" ? (
        <FormMessage message={state.message} tone="success" />
      ) : null}

      <SubmitButton pendingText="Saving…">Save budget</SubmitButton>
    </form>
  );
}
