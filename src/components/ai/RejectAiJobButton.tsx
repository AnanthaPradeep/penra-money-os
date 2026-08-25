"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_AI_ACTION_STATE } from "@/lib/ai/action-state";
import { rejectAiJobAction } from "@/lib/ai/actions";

export function RejectAiJobButton({ jobId }: Readonly<{ jobId: string }>) {
  const [state, formAction] = useActionState(
    rejectAiJobAction,
    INITIAL_AI_ACTION_STATE,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <SubmitButton variant="ghost" pendingText="Rejecting…" className="w-fit">
        Reject this output
      </SubmitButton>
    </form>
  );
}
