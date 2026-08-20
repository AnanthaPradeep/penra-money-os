"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { INITIAL_RECURRING_ACTION_STATE } from "@/lib/recurring/action-state";
import { setRecurringItemStatusAction } from "@/lib/recurring/actions";
import type { RecurringItemStatus } from "@/lib/recurring/types";

type RecurringItemActionsProps = {
  recurringItemId: string;
  status: RecurringItemStatus;
};

/** Pause/resume/cancel/archive — see set_recurring_item_status (supabase/migrations) for the allowed transitions this mirrors. */
export function RecurringItemActions({
  recurringItemId,
  status,
}: Readonly<RecurringItemActionsProps>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setStatus(nextStatus: RecurringItemStatus) {
    setPending(true);
    const formData = new FormData();
    formData.set("recurringItemId", recurringItemId);
    formData.set("status", nextStatus);
    await setRecurringItemStatusAction(
      INITIAL_RECURRING_ACTION_STATE,
      formData,
    );
    setPending(false);
    router.refresh();
  }

  if (status === "archived") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {status === "active" ? (
        <Button
          type="button"
          variant="outline"
          isLoading={pending}
          onClick={() => void setStatus("paused")}
        >
          Pause
        </Button>
      ) : null}
      {status === "paused" ? (
        <Button
          type="button"
          variant="outline"
          isLoading={pending}
          onClick={() => void setStatus("active")}
        >
          Resume
        </Button>
      ) : null}
      {status === "active" || status === "paused" ? (
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline">
              Cancel
            </Button>
          }
          title="Cancel this recurring item?"
          description="This stops all future occurrences. Anything already posted stays in your transaction history — nothing is deleted, and a cancelled item can't be reactivated (you'd create a new one instead)."
          confirmLabel="Cancel recurring item"
          tone="destructive"
          isConfirming={pending}
          onConfirm={() => setStatus("cancelled")}
        />
      ) : null}
      {status === "cancelled" ? (
        <Button
          type="button"
          variant="outline"
          isLoading={pending}
          onClick={() => void setStatus("archived")}
        >
          Archive
        </Button>
      ) : null}
    </div>
  );
}
