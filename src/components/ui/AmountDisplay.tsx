import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Decimal, type Money } from "@/lib/money/decimal";
import { formatINR } from "@/lib/money/format";
import { cn } from "@/lib/ui/cn";

type AmountDisplayProps = {
  value: Money | string;
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * "neutral" — a plain formatted amount (account balance, credit limit).
   * Asset-vs-liability meaning belongs in adjacent text/labelling, not the
   * amount's colour — a liability balance isn't an "error" state.
   * "signed" — a ledger movement (a single entry/transaction amount):
   * coloured, carries a direction icon, and an explicit +/− sign, so the
   * direction is never conveyed by colour alone.
   */
  variant?: "neutral" | "signed";
  className?: string;
};

const SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl font-semibold",
  xl: "text-3xl font-semibold",
} as const;

/** Renders a money value with tabular numerals — never converts to a JS number for anything but this final display formatting. */
export function AmountDisplay({
  value,
  size = "md",
  variant = "neutral",
  className,
}: Readonly<AmountDisplayProps>) {
  const decimal = typeof value === "string" ? new Decimal(value) : value;

  if (variant === "neutral" || decimal.isZero()) {
    return (
      <span className={cn("tabular-nums", SIZE_CLASSES[size], className)}>
        {formatINR(decimal)}
      </span>
    );
  }

  const isNegative = decimal.isNegative();
  const Icon = isNegative ? ArrowDownRight : ArrowUpRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        isNegative ? "text-negative" : "text-positive",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-[1em] shrink-0" />
      <span>
        <span aria-hidden="true">{isNegative ? "" : "+"}</span>
        <span className="sr-only">
          {isNegative ? "decrease of " : "increase of "}
        </span>
        {formatINR(decimal)}
      </span>
    </span>
  );
}
