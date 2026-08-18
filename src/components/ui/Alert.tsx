import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

const alertVariants = cva(
  "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-info/30 bg-info-surface text-info",
        positive: "border-positive/30 bg-positive-surface text-positive",
        warning: "border-warning/30 bg-warning-surface text-warning",
        negative: "border-negative/30 bg-negative-surface text-negative",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const ICONS = {
  info: Info,
  positive: CheckCircle2,
  warning: AlertTriangle,
  negative: AlertTriangle,
} as const;

type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & { title?: string; children: ReactNode };

/** A persistent, in-page notice — for guidance and status that should stay visible, not a transient toast. */
export function Alert({
  className,
  variant = "info",
  title,
  children,
  ...props
}: Readonly<AlertProps>) {
  const Icon = ICONS[variant ?? "info"];

  return (
    <div
      role={variant === "negative" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5 text-foreground">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
