import {
  Archive,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Lock,
  RotateCcw,
  SkipForward,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";

export type Status =
  | "active"
  | "archived"
  | "posted"
  | "reversed"
  | "paused"
  | "cancelled"
  | "upcoming"
  | "due"
  | "overdue"
  | "skipped"
  | "failed"
  | "matured"
  | "closed";

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    variant: "positive" | "neutral" | "warning" | "negative" | "info";
    icon: typeof CheckCircle2;
  }
> = {
  active: { label: "Active", variant: "positive", icon: CheckCircle2 },
  archived: { label: "Archived", variant: "neutral", icon: Archive },
  posted: { label: "Posted", variant: "positive", icon: CheckCircle2 },
  reversed: { label: "Reversed", variant: "warning", icon: RotateCcw },
  paused: { label: "Paused", variant: "neutral", icon: Clock },
  cancelled: { label: "Cancelled", variant: "neutral", icon: XCircle },
  upcoming: { label: "Upcoming", variant: "info", icon: CalendarClock },
  due: { label: "Due", variant: "warning", icon: Clock },
  overdue: { label: "Overdue", variant: "negative", icon: AlertTriangle },
  skipped: { label: "Skipped", variant: "neutral", icon: SkipForward },
  failed: { label: "Failed", variant: "negative", icon: AlertTriangle },
  matured: { label: "Matured", variant: "positive", icon: CheckCircle2 },
  closed: { label: "Closed", variant: "neutral", icon: Lock },
};

/** A status indicator that never relies on colour alone — every state also carries a distinct icon and text label. */
export function StatusBadge({ status }: Readonly<{ status: Status }>) {
  const { label, variant, icon: Icon } = STATUS_CONFIG[status];

  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </Badge>
  );
}
