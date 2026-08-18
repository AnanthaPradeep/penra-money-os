import { Loader2 } from "lucide-react";

import { cn } from "@/lib/ui/cn";

type SpinnerProps = {
  className?: string;
  /** Accessible label announced to screen readers — the spinner icon itself is always aria-hidden. */
  label?: string;
};

/** A small inline loading indicator. Prefer a Skeleton for whole-section loading states; reserve this for compact, in-place loading (e.g. inside a button). */
export function Spinner({
  className,
  label = "Loading",
}: Readonly<SpinnerProps>) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2
        aria-hidden="true"
        className={cn(
          "size-4 animate-spin motion-reduce:animate-none",
          className,
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
