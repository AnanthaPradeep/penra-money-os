"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { IPO_STATUS_VARIANTS } from "@/components/ipo/statusVariants";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { IpoIssue, IpoWatchlistItem } from "@/lib/ipo/mapping";
import { IPO_STATUS_LABELS, IPO_STATUSES } from "@/lib/ipo/types";

type IpoListProps = {
  ipos: IpoIssue[];
  watchlistItems: IpoWatchlistItem[];
};

export function IpoList({ ipos, watchlistItems }: Readonly<IpoListProps>) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const watchedIpoIds = useMemo(
    () => new Set(watchlistItems.map((w) => w.ipoIssueId)),
    [watchlistItems],
  );

  const filtered = statusFilter
    ? ipos.filter((ipo) => ipo.status === statusFilter)
    : ipos;

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <Select
          id="ipo-status-filter"
          name="statusFilter"
          label="Filter by status"
          placeholder="All statuses"
          defaultValue=""
          onChange={(e) => setStatusFilter(e.target.value)}
          options={IPO_STATUSES.map((s) => ({
            value: s,
            label: IPO_STATUS_LABELS[s],
          }))}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ipos.length === 0
            ? "No IPOs in the catalogue yet. Add one from an official SEBI/NSE/BSE source."
            : "No IPOs match this filter."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((ipo) => (
            <li key={ipo.id}>
              <Link href={`/app/ipos/${ipo.id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {watchedIpoIds.has(ipo.id) ? (
                          <Star
                            aria-hidden="true"
                            className="size-3.5 shrink-0 fill-primary text-primary"
                          />
                        ) : null}
                        <p className="truncate font-medium text-foreground">
                          {ipo.issuerName}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ipo.board === "mainboard" ? "Mainboard" : "SME"}
                        {ipo.exchange ? ` · ${ipo.exchange}` : ""}
                        {ipo.issueOpenDate
                          ? ` · Opens ${ipo.issueOpenDate}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant={IPO_STATUS_VARIANTS[ipo.status]}>
                      {IPO_STATUS_LABELS[ipo.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
