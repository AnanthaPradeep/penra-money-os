"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

export type PayoffCustomOrderControlProps = {
  debts: { id: string; name: string }[];
  initialOrder: string[];
};

/**
 * A pure client-side reordering widget for the "custom order" payoff
 * strategy. Its only job is to produce a comma-separated debt-id order in
 * a hidden field that submits alongside the page's existing GET form (see
 * src/app/app/debts/strategy/page.tsx) — payoff.ts's comparePayoffStrategies
 * already fully supports an arbitrary customOrder, this was previously
 * just never exposed in the UI.
 */
export function PayoffCustomOrderControl({
  debts,
  initialOrder,
}: Readonly<PayoffCustomOrderControlProps>) {
  const byId = new Map(debts.map((d) => [d.id, d]));
  const [order, setOrder] = useState<string[]>(
    initialOrder.filter((id) => byId.has(id)),
  );

  function move(index: number, direction: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return prev;
      }
      const [item] = next.splice(index, 1);
      if (item === undefined) {
        return prev;
      }
      next.splice(target, 0, item);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-elevated p-3">
      <p className="text-xs text-muted-foreground">
        Priority order for the &ldquo;Custom order&rdquo; strategy below — the
        debt at the top is paid off first with any extra payment.
      </p>
      <ol className="flex flex-col gap-1.5">
        {order.map((id, index) => {
          const debt = byId.get(id);
          if (!debt) {
            return null;
          }
          return (
            <li
              key={id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="text-foreground">
                {index + 1}. {debt.name}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${debt.name} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${debt.name} down`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </Button>
              </span>
            </li>
          );
        })}
      </ol>
      <input type="hidden" name="order" value={order.join(",")} />
    </div>
  );
}
