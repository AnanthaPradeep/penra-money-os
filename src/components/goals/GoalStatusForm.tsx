"use client";

import { useActionState } from "react";

import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_GOAL_ACTION_STATE } from "@/lib/goals/action-state";
import { setFinancialGoalStatusAction } from "@/lib/goals/actions";
import { GOAL_STATUSES, type GoalStatus } from "@/lib/goals/mapping";

const STATUS_OPTIONS = GOAL_STATUSES.map((s) => ({ value: s, label: s }));

export function GoalStatusForm({
  goalId,
  status,
}: Readonly<{ goalId: string; status: GoalStatus }>) {
  const [, formAction] = useActionState(
    setFinancialGoalStatusAction,
    INITIAL_GOAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="goalId" value={goalId} />
      <div className="w-40">
        <Select
          id="goal-status"
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
