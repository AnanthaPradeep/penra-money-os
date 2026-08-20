"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { setInvestmentHoldingStatusAction } from "@/lib/investments/actions";
import type { InvestmentHoldingStatus } from "@/lib/investments/types";

type HoldingActionsProps = {
  holdingId: string;
  status: InvestmentHoldingStatus;
};

/** Archive/reactivate a holding — see set_investment_holding_status (supabase/migrations). Archiving blocks new activities but never deletes or hides history. */
export function HoldingActions({
  holdingId,
  status,
}: Readonly<HoldingActionsProps>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setStatus(nextStatus: InvestmentHoldingStatus) {
    setPending(true);
    const formData = new FormData();
    formData.set("holdingId", holdingId);
    formData.set("status", nextStatus);
    await setInvestmentHoldingStatusAction(
      INITIAL_INVESTMENT_ACTION_STATE,
      formData,
    );
    setPending(false);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      isLoading={pending}
      onClick={() =>
        void setStatus(status === "active" ? "archived" : "active")
      }
    >
      {status === "active" ? "Archive" : "Reactivate"}
    </Button>
  );
}
