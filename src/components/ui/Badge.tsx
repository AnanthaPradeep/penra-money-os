import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/ui/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted-surface text-foreground",
        primary: "border-primary/25 bg-primary/10 text-primary",
        positive: "border-positive/25 bg-positive-surface text-positive",
        negative: "border-negative/25 bg-negative-surface text-negative",
        warning: "border-warning/25 bg-warning-surface text-warning",
        info: "border-info/25 bg-info-surface text-info",
        accent: "border-accent/30 bg-accent/10 text-accent",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: Readonly<BadgeProps>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
