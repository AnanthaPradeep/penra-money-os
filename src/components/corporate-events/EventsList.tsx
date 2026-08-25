"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CORPORATE_EVENT_STATUS_VARIANTS } from "@/components/corporate-events/statusVariants";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { CorporateEvent } from "@/lib/corporate-events/mapping";
import {
  CORPORATE_EVENT_STATUS_LABELS,
  CORPORATE_EVENT_TYPE_LABELS,
  CORPORATE_EVENT_TYPES,
} from "@/lib/corporate-events/types";
import type { MarketInstrument } from "@/lib/market-data/mapping";

type EventsListProps = {
  events: CorporateEvent[];
  instrumentsById: Record<string, MarketInstrument>;
};

function relevantDate(event: CorporateEvent): string | null {
  return (
    event.exDate ??
    event.recordDate ??
    event.meetingOrResultDate ??
    event.paymentDate ??
    event.effectiveDate ??
    event.announcementAt?.slice(0, 10) ??
    null
  );
}

export function EventsList({
  events,
  instrumentsById,
}: Readonly<EventsListProps>) {
  const [typeFilter, setTypeFilter] = useState("");
  const filtered = typeFilter
    ? events.filter((e) => e.eventType === typeFilter)
    : events;

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <Select
          id="event-type-filter"
          name="eventTypeFilter"
          label="Filter by type"
          placeholder="All types"
          defaultValue=""
          onChange={(e) => setTypeFilter(e.target.value)}
          options={CORPORATE_EVENT_TYPES.map((t) => ({
            value: t,
            label: CORPORATE_EVENT_TYPE_LABELS[t],
          }))}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events to show.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((event) => {
            const instrument = instrumentsById[event.instrumentId];
            const date = relevantDate(event);
            return (
              <li key={event.id}>
                <Link href={`/app/events/${event.id}`}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="truncate font-medium text-foreground">
                          {event.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {instrument?.name ?? "Unknown instrument"}
                          {date ? ` · ${date}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="neutral">
                          {CORPORATE_EVENT_TYPE_LABELS[event.eventType]}
                        </Badge>
                        <Badge
                          variant={
                            CORPORATE_EVENT_STATUS_VARIANTS[event.status]
                          }
                        >
                          {CORPORATE_EVENT_STATUS_LABELS[event.status]}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
