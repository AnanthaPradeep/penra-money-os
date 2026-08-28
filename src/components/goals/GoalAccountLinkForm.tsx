"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_GOAL_ACTION_STATE } from "@/lib/goals/action-state";
import { linkGoalAccountAction, unlinkGoalAccountAction } from "@/lib/goals/actions";

type GoalAccountLinkFormProps = {
  goalId: string;
  accounts: { id: string; name: string }[];
  linkedAccounts: { id: string; name: string }[];
};

/** Informational linkage only — see goal_account_links' own comment in the Phase 12 migration: never a source of additional balance, just a pointer to a real account associated with this goal (e.g. a dedicated savings account). */
export function GoalAccountLinkForm({
  goalId,
  accounts,
  linkedAccounts,
}: Readonly<GoalAccountLinkFormProps>) {
  const [linkState, linkAction] = useActionState(
    linkGoalAccountAction,
    INITIAL_GOAL_ACTION_STATE,
  );
  const [unlinkState, unlinkAction] = useActionState(
    unlinkGoalAccountAction,
    INITIAL_GOAL_ACTION_STATE,
  );

  const linkedIds = new Set(linkedAccounts.map((a) => a.id));
  const linkableOptions = accounts
    .filter((a) => !linkedIds.has(a.id))
    .map((a) => ({ value: a.id, label: a.name }));

  return (
    <div className="flex flex-col gap-3">
      {linkedAccounts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {linkedAccounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
            >
              <span className="text-foreground">{account.name}</span>
              <form action={unlinkAction}>
                <input type="hidden" name="goalId" value={goalId} />
                <input type="hidden" name="accountId" value={account.id} />
                <button
                  type="submit"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Unlink
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      {unlinkState.status === "error" ? (
        <FormMessage message={unlinkState.message} tone="error" />
      ) : null}

      {linkableOptions.length > 0 ? (
        <form action={linkAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="goalId" value={goalId} />
          <div className="w-56">
            <Select
              id="goal-link-account"
              name="accountId"
              label="Link a real account"
              options={linkableOptions}
              placeholder="Choose an account"
            />
          </div>
          <SubmitButton pendingText="Linking…" variant="outline" className="w-fit">
            Link account
          </SubmitButton>
        </form>
      ) : null}
      {linkState.status === "error" ? (
        <FormMessage message={linkState.message} tone="error" />
      ) : null}
    </div>
  );
}
