"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_GOAL_ACTION_STATE } from "@/lib/goals/action-state";
import { saveGoalMilestoneAction } from "@/lib/goals/actions";

/** Adds a display-only progress checkpoint to a goal (e.g. "50% there") — see save_goal_milestone; achieved_at is only ever set explicitly by the user, never inferred from progress automatically. */
export function GoalMilestoneForm({ goalId }: Readonly<{ goalId: string }>) {
  const [state, formAction] = useActionState(
    saveGoalMilestoneAction,
    INITIAL_GOAL_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Add a milestone</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="goalId" value={goalId} />
          <Field
            id="milestone-name"
            name="name"
            label="Milestone name"
            required
            placeholder="e.g. Halfway there"
            error={fieldError("name")}
          />
          <Field
            id="milestone-target-amount"
            name="targetAmount"
            label="Target amount"
            required
            inputMode="decimal"
            error={fieldError("targetAmount")}
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="achieved"
              value="true"
              className="size-4 rounded border-input-border"
            />
            Already achieved
          </label>
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton
            pendingText="Saving…"
            variant="outline"
            className="w-fit"
          >
            Add milestone
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
