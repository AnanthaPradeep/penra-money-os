"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
};

/** A hover/focus tooltip for supplementary hints — never the only place a piece of information appears. */
export function Tooltip({
  content,
  children,
  side = "top",
}: Readonly<TooltipProps>) {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-xs rounded-md border border-border bg-elevated px-3 py-1.5 text-xs text-elevated-foreground shadow-md",
            "data-[state=delayed-open]:animate-[penra-zoom-in_120ms_ease-out]",
            "data-[state=closed]:animate-[penra-zoom-out_100ms_ease-in]",
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-elevated" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
