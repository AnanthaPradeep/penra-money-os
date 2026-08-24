"use client";

import { Briefcase, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import {
  removeWatchlistItemAction,
  updateWatchlistItemAction,
} from "@/lib/research/actions";
import type { MarketInstrument } from "@/lib/market-data/mapping";
import type { WatchlistItem } from "@/lib/research/mapping";
import {
  RESEARCH_STATUS_LABELS,
  RESEARCH_STATUSES,
} from "@/lib/research/types";
import { PRIORITY_LABELS, RESEARCH_STATUS_VARIANTS } from "./statusVariants";

type WatchlistItemRowProps = {
  item: WatchlistItem;
  instrument: MarketInstrument | null;
  isOwned: boolean;
};

export function WatchlistItemRow({
  item,
  instrument,
  isOwned,
}: Readonly<WatchlistItemRowProps>) {
  const router = useRouter();
  const [statusPending, setStatusPending] = useState(false);
  const [removePending, setRemovePending] = useState(false);

  async function handleStatusChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ) {
    setStatusPending(true);
    const formData = new FormData();
    formData.set("itemId", item.id);
    formData.set("researchStatus", event.target.value);
    await updateWatchlistItemAction({ status: "idle" }, formData);
    setStatusPending(false);
    router.refresh();
  }

  async function handleRemove() {
    setRemovePending(true);
    const formData = new FormData();
    formData.set("itemId", item.id);
    await removeWatchlistItemAction({ status: "idle" }, formData);
    setRemovePending(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/research/companies/${item.instrumentId}`}
              className="truncate font-medium text-foreground hover:underline"
            >
              {instrument?.name ?? "Unknown company"}
            </Link>
            {isOwned ? (
              <Badge variant="positive">
                <Briefcase aria-hidden="true" className="size-3" />
                Owned
              </Badge>
            ) : null}
            <Badge variant={RESEARCH_STATUS_VARIANTS[item.researchStatus]}>
              {RESEARCH_STATUS_LABELS[item.researchStatus]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {instrument?.symbol ?? instrument?.providerInstrumentId ?? "—"}
            {instrument?.exchange ? ` · ${instrument.exchange}` : ""}
            {" · "}
            {PRIORITY_LABELS[item.priority]}
            {item.targetReviewDate
              ? ` · review by ${item.targetReviewDate}`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-44">
            <Select
              id={`status-${item.id}`}
              name="researchStatus"
              label="Research status"
              defaultValue={item.researchStatus}
              onChange={(event) => void handleStatusChange(event)}
              options={RESEARCH_STATUSES.map((status) => ({
                value: status,
                label: RESEARCH_STATUS_LABELS[status],
              }))}
            />
            <span className="sr-only" aria-live="polite">
              {statusPending ? "Saving…" : ""}
            </span>
          </div>
          <ConfirmDialog
            trigger={
              <IconButton
                icon={<X aria-hidden="true" className="size-4" />}
                aria-label={`Remove ${instrument?.name ?? "company"} from watchlist`}
              />
            }
            title="Remove from this watchlist?"
            description="This only removes it from this watchlist — it never deletes the company's research notes, filings, or thesis."
            confirmLabel="Remove"
            tone="destructive"
            onConfirm={handleRemove}
            isConfirming={removePending}
          />
        </div>
      </CardContent>
    </Card>
  );
}
