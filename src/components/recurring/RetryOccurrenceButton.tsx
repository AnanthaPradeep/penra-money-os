"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { INITIAL_RECURRING_ACTION_STATE } from "@/lib/recurring/action-state";
import { retryFailedOccurrenceAction } from "@/lib/recurring/actions";

type RetryOccurrenceButtonProps = {
  occurrenceId: string;
};

/** Retries a failed auto_post occurrence — reuses the exact same posting core the scheduled processor and the original attempt used. */
export function RetryOccurrenceButton({
  occurrenceId,
}: Readonly<RetryOccurrenceButtonProps>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("occurrenceId", occurrenceId);
    const result = await retryFailedOccurrenceAction(
      INITIAL_RECURRING_ACTION_STATE,
      formData,
    );
    setPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        isLoading={pending}
        onClick={() => void retry()}
      >
        Retry
      </Button>
      {error ? <FormMessage message={error} tone="error" /> : null}
    </div>
  );
}
