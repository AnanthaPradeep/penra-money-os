"use client";

import { useMemo, useState } from "react";

import { RecurringItemRow } from "@/components/recurring/RecurringItemRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { RecurringItem } from "@/lib/recurring/mapping";
import { RECURRING_ITEM_KIND_LABELS } from "@/lib/recurring/types";

type KindFilter = "all" | "subscription" | "bill" | "income" | "transfer";

const KIND_FILTER_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "subscription", label: RECURRING_ITEM_KIND_LABELS.subscription },
  { value: "bill", label: RECURRING_ITEM_KIND_LABELS.bill },
  { value: "income", label: RECURRING_ITEM_KIND_LABELS.income },
  { value: "transfer", label: RECURRING_ITEM_KIND_LABELS.transfer },
];

/** Client-side kind filter + name search over the caller's full recurring-item list — a personal app's item count never justifies server-side pagination here. */
export function RecurringItemsFilterList({
  items,
}: Readonly<{ items: RecurringItem[] }>) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) {
        return false;
      }
      if (query && !item.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [items, kind, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          label="Filter by kind"
          options={KIND_FILTER_OPTIONS}
          value={kind}
          onChange={setKind}
        />
        <Input
          type="search"
          placeholder="Search by name…"
          aria-label="Search recurring items"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:w-64"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No recurring items"
          description="Nothing matches this filter yet."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <RecurringItemRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
