"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { INITIAL_BUDGET_ACTION_STATE } from "@/lib/budgets/action-state";
import { copyBudgetPeriodAction } from "@/lib/budgets/actions";

type CopyPreviousMonthButtonProps = {
  sourcePeriodMonth: string;
  targetPeriodMonth: string;
};

/** Copies the previous month's allocations into this one — idempotent "fill in missing categories," never overwrites an allocation already saved for this month (see copy_budget_period, supabase/migrations). */
export function CopyPreviousMonthButton({
  sourcePeriodMonth,
  targetPeriodMonth,
}: Readonly<CopyPreviousMonthButtonProps>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("sourcePeriodMonth", sourcePeriodMonth);
    formData.set("targetPeriodMonth", targetPeriodMonth);
    const result = await copyBudgetPeriodAction(
      INITIAL_BUDGET_ACTION_STATE,
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
        onClick={() => void copy()}
      >
        Copy previous month
      </Button>
      {error ? <FormMessage message={error} tone="error" /> : null}
    </div>
  );
}
