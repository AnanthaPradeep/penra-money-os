import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Card, CardContent } from "@/components/ui/Card";
import type {
  BudgetProgressStatus,
  CategoryBudgetProgress,
} from "@/lib/budgets/mapping";

const STATUS_BAR_CLASSES: Record<BudgetProgressStatus, string> = {
  safe: "bg-positive",
  warning: "bg-warning",
  reached: "bg-primary",
  exceeded: "bg-negative",
};

const STATUS_LABELS: Record<BudgetProgressStatus, string> = {
  safe: "On track",
  warning: "Nearing limit",
  reached: "At limit",
  exceeded: "Over budget",
};

export function CategoryProgressRow({
  progress,
}: Readonly<{ progress: CategoryBudgetProgress }>) {
  const percentForBar = progress.usagePercent
    ? Math.min(progress.usagePercent.toNumber(), 100)
    : progress.actualAmount.greaterThan(0)
      ? 100
      : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full border border-border"
              style={{
                backgroundColor: progress.categoryColor ?? "transparent",
              }}
            />
            <span className="truncate font-medium text-foreground">
              {progress.categoryName}
            </span>
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {STATUS_LABELS[progress.status]}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={Math.round(percentForBar)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress.categoryName} budget usage`}
          className="h-2 w-full overflow-hidden rounded-full bg-muted-surface"
        >
          <div
            className={`h-full rounded-full transition-[width] ${STATUS_BAR_CLASSES[progress.status]}`}
            style={{ width: `${percentForBar}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            <AmountDisplay value={progress.actualAmount} size="sm" /> of{" "}
            <AmountDisplay value={progress.plannedAmount} size="sm" />
          </span>
          <span
            className={
              progress.remainingAmount.isNegative()
                ? "font-medium text-negative"
                : "text-muted-foreground"
            }
          >
            {progress.remainingAmount.isNegative()
              ? `${progress.remainingAmount.abs().toString()} over`
              : `${progress.remainingAmount.toString()} left`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
