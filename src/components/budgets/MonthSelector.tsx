import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

function addMonths(periodMonth: string, months: number): string {
  const [year, month] = periodMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + months, 1));
  return date.toISOString().slice(0, 7);
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** periodMonth is "YYYY-MM" (the [month] route param) — prev/next are plain links so the page stays a Server Component. */
export function MonthSelector({
  periodMonth,
}: Readonly<{ periodMonth: string }>) {
  const previous = addMonths(periodMonth, -1);
  const next = addMonths(periodMonth, 1);
  const label = MONTH_LABEL_FORMATTER.format(
    new Date(`${periodMonth}-01T00:00:00Z`),
  );

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/app/budgets/${previous}`}
        aria-label="Previous month"
        className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-input-border hover:text-foreground"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Link>
      <span className="min-w-32 text-center text-sm font-medium text-foreground">
        {label}
      </span>
      <Link
        href={`/app/budgets/${next}`}
        aria-label="Next month"
        className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-input-border hover:text-foreground"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
