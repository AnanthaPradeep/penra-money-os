import type { HTMLAttributes } from "react";

import { cn } from "@/lib/ui/cn";

/** A loading placeholder shaped like the content it stands in for — prefer this over a full-page spinner wherever the final layout is known. */
export function Skeleton({
  className,
  ...props
}: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-muted-surface motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
