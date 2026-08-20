"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { reverseInvestmentActivityAction } from "@/lib/investments/actions";

type ReverseActivityButtonProps = {
  activityId: string;
};

/** Reverses a posted activity's ledger effect and marks it reversed — see reverse_investment_activity (supabase/migrations). The original is never deleted, preserving full audit history. */
export function ReverseActivityButton({
  activityId,
}: Readonly<ReverseActivityButtonProps>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reverse() {
    setPending(true);
    const formData = new FormData();
    formData.set("activityId", activityId);
    await reverseInvestmentActivityAction(
      INITIAL_INVESTMENT_ACTION_STATE,
      formData,
    );
    setPending(false);
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Reverse
        </Button>
      }
      title="Reverse this activity?"
      description="This posts an offsetting ledger entry and restores the holding's quantity/cost basis to what it was before this activity. The original stays in your history, marked as reversed — nothing is deleted."
      confirmLabel="Reverse activity"
      tone="destructive"
      isConfirming={pending}
      onConfirm={reverse}
    />
  );
}
