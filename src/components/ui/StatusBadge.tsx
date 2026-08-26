import {
  Archive,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileUp,
  HelpCircle,
  Link2,
  Lock,
  PenLine,
  RotateCcw,
  Scale,
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
  | "closed"
  | "fresh"
  | "delayed"
  | "stale"
  | "missing"
  | "uploaded"
  | "mapping_required"
  | "reviewing"
  | "ready"
  | "posting"
  | "completed"
  | "discarded"
  | "balanced"
  | "unreconciled"
  | "draft"
  | "paid_off"
  | "defaulted";

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
  fresh: { label: "Fresh", variant: "positive", icon: CheckCircle2 },
  delayed: { label: "Delayed", variant: "warning", icon: Clock },
  stale: { label: "Stale", variant: "negative", icon: AlertTriangle },
  missing: { label: "Missing", variant: "neutral", icon: HelpCircle },
  uploaded: { label: "Uploaded", variant: "info", icon: FileUp },
  mapping_required: { label: "Needs mapping", variant: "warning", icon: Link2 },
  reviewing: { label: "In review", variant: "info", icon: Clock },
  ready: { label: "Ready to post", variant: "positive", icon: CheckCircle2 },
  posting: { label: "Posting", variant: "warning", icon: Clock },
  completed: { label: "Completed", variant: "positive", icon: CheckCircle2 },
  discarded: { label: "Discarded", variant: "neutral", icon: Archive },
  balanced: { label: "Balanced", variant: "positive", icon: Scale },
  unreconciled: { label: "Unreconciled", variant: "warning", icon: Scale },
  draft: { label: "Draft", variant: "neutral", icon: PenLine },
  paid_off: { label: "Paid off", variant: "positive", icon: CheckCircle2 },
  defaulted: { label: "Defaulted", variant: "negative", icon: AlertTriangle },
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
