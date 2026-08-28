"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_GOAL_ACTION_STATE } from "@/lib/goals/action-state";
import { setGoalLinkedRecurringItemAction } from "@/lib/goals/actions";

type SinkingFundRecurringItemFormProps = {
  goalId: string;
  recurringItems: { id: string; name: string; kindLabel: string }[];
  linkedRecurringItemId: string | null;
};

/** Links this sinking fund to the recurring bill/subscription it's saving toward (e.g. an annual insurance premium) — purely informational, never changes how contributions are recorded. */
export function SinkingFundRecurringItemForm({
  goalId,
  recurringItems,
  linkedRecurringItemId,
}: Readonly<SinkingFundRecurringItemFormProps>) {
  const [state, formAction] = useActionState(
    setGoalLinkedRecurringItemAction,
    INITIAL_GOAL_ACTION_STATE,
  );

  const options = [
    { value: "", label: "Not linked to a recurring item" },
    ...recurringItems.map((item) => ({
      value: item.id,
      label: `${item.name} (${item.kindLabel})`,
    })),
  ];

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="goalId" value={goalId} />
      <div className="w-64">
        <Select
          id="sf-linked-recurring-item"
          name="recurringItemId"
          label="Linked recurring item"
          options={options}
          defaultValue={linkedRecurringItemId ?? ""}
        />
      </div>
      <SubmitButton pendingText="Saving…" variant="outline" className="w-fit">
        Save link
      </SubmitButton>
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
    </form>
  );
}
