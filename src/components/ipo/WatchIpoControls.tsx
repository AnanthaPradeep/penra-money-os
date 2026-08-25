"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { IPO_RESEARCH_STATUS_VARIANTS } from "@/components/ipo/statusVariants";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_IPO_ACTION_STATE } from "@/lib/ipo/action-state";
import {
  unwatchIpoAction,
  updateIpoWatchlistItemAction,
  watchIpoAction,
} from "@/lib/ipo/actions";
import type { IpoWatchlistItem } from "@/lib/ipo/mapping";
import {
  IPO_RESEARCH_PRIORITIES,
  IPO_RESEARCH_PRIORITY_LABELS,
  IPO_RESEARCH_STATUS_LABELS,
  IPO_RESEARCH_STATUSES,
} from "@/lib/ipo/types";

type WatchIpoControlsProps = {
  ipoIssueId: string;
  watchlistItem: IpoWatchlistItem | null;
};

/** Watch/unwatch + private research-status tracking for one IPO — never an "apply" action, matching outcome #4's explicit scope. */
export function WatchIpoControls({
  ipoIssueId,
  watchlistItem,
}: Readonly<WatchIpoControlsProps>) {
  const router = useRouter();
  const [watchState, watchAction] = useActionState(
    watchIpoAction,
    INITIAL_IPO_ACTION_STATE,
  );
  const [unwatchState, unwatchFormAction] = useActionState(
    unwatchIpoAction,
    INITIAL_IPO_ACTION_STATE,
  );
  const [updateState, updateFormAction] = useActionState(
    updateIpoWatchlistItemAction,
    INITIAL_IPO_ACTION_STATE,
  );

  useEffect(() => {
    if (
      watchState.status === "success" ||
      unwatchState.status === "success" ||
      updateState.status === "success"
    ) {
      router.refresh();
    }
  }, [watchState, unwatchState, updateState, router]);

  if (!watchlistItem) {
    return (
      <form action={watchAction}>
        <input type="hidden" name="ipoIssueId" value={ipoIssueId} />
        <SubmitButton pendingText="Adding…" className="w-fit">
          Watch this IPO
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={IPO_RESEARCH_STATUS_VARIANTS[watchlistItem.researchStatus]}
        >
          {IPO_RESEARCH_STATUS_LABELS[watchlistItem.researchStatus]}
        </Badge>
        <form action={unwatchFormAction}>
          <input
            type="hidden"
            name="watchlistItemId"
            value={watchlistItem.id}
          />
          <Button type="submit" variant="ghost" size="sm">
            Unwatch
          </Button>
        </form>
      </div>
      <form
        action={updateFormAction}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="watchlistItemId" value={watchlistItem.id} />
        <div className="w-full sm:w-44">
          <Select
            id="ipo-watch-priority"
            name="priority"
            label="Priority"
            defaultValue={watchlistItem.priority}
            options={IPO_RESEARCH_PRIORITIES.map((p) => ({
              value: p,
              label: IPO_RESEARCH_PRIORITY_LABELS[p],
            }))}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            id="ipo-watch-research-status"
            name="researchStatus"
            label="Research status"
            defaultValue={watchlistItem.researchStatus}
            options={IPO_RESEARCH_STATUSES.map((s) => ({
              value: s,
              label: IPO_RESEARCH_STATUS_LABELS[s],
            }))}
          />
        </div>
        <div className="w-full sm:w-44">
          <Field
            id="ipo-watch-review-date"
            name="targetReviewDate"
            label="Review by"
            type="date"
            defaultValue={watchlistItem.targetReviewDate ?? ""}
          />
        </div>
        <SubmitButton pendingText="Saving…" className="w-fit">
          Save
        </SubmitButton>
      </form>
    </div>
  );
}
