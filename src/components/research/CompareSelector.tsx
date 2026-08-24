"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StockInstrumentPicker } from "@/components/research/StockInstrumentPicker";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import type { MarketInstrument } from "@/lib/market-data/mapping";

const MIN_COMPANIES = 2;
const MAX_COMPANIES = 5;

/** Lets the user pick 2-5 companies, then navigates to /app/research/compare?ids=... — the comparison itself is computed server-side by the target page from those ids. */
export function CompareSelector({
  initial = [],
}: Readonly<{ initial?: (MarketInstrument | null)[] }>) {
  const router = useRouter();
  const [slots, setSlots] = useState<(MarketInstrument | null)[]>(
    initial.length >= MIN_COMPANIES
      ? initial
      : [...initial, null, null].slice(
          0,
          Math.max(MIN_COMPANIES, initial.length),
        ),
  );

  const filledCount = slots.filter(
    (s): s is MarketInstrument => s !== null,
  ).length;
  const canCompare = filledCount >= MIN_COMPANIES;

  function handleCompare() {
    const ids = slots
      .filter((s): s is MarketInstrument => s !== null)
      .map((s) => s.id);
    router.push(`/app/research/compare?ids=${ids.join(",")}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        {slots.map((slot, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1">
              <StockInstrumentPicker
                name={`company-${index}`}
                label={`Company ${index + 1}`}
                initial={slot}
                onChange={(instrument) =>
                  setSlots((prev) =>
                    prev.map((s, i) => (i === index ? instrument : s)),
                  )
                }
              />
            </div>
            {slots.length > MIN_COMPANIES ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove company ${index + 1}`}
                onClick={() =>
                  setSlots((prev) => prev.filter((_, i) => i !== index))
                }
              >
                <Minus aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
        <div className="flex items-center justify-between gap-3">
          {slots.length < MAX_COMPANIES ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSlots((prev) => [...prev, null])}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add company
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" disabled={!canCompare} onClick={handleCompare}>
            Compare
          </Button>
        </div>
        {!canCompare ? (
          <p className="text-xs text-muted-foreground">
            Pick at least {MIN_COMPANIES} companies to compare.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
