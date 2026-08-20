"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { INITIAL_RECURRING_ACTION_STATE } from "@/lib/recurring/action-state";
import { skipOccurrenceAction } from "@/lib/recurring/actions";

type SkipOccurrenceButtonProps = {
  occurrenceId: string;
};

/** Skips a due reminder-only occurrence — no transaction is created, and the recurring item's future cycles are unaffected. */
export function SkipOccurrenceButton({
  occurrenceId,
}: Readonly<SkipOccurrenceButtonProps>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function skip() {
    setPending(true);
    const formData = new FormData();
    formData.set("occurrenceId", occurrenceId);
    await skipOccurrenceAction(INITIAL_RECURRING_ACTION_STATE, formData);
    setPending(false);
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Skip
        </Button>
      }
      title="Skip this occurrence?"
      description="No transaction is created for this cycle. Future occurrences and the recurring item itself are unaffected."
      confirmLabel="Skip occurrence"
      isConfirming={pending}
      onConfirm={skip}
    />
  );
}
