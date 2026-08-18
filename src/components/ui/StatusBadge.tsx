import { Archive, CheckCircle2, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

export type Status = "active" | "archived" | "posted" | "reversed";

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    variant: "positive" | "neutral" | "warning";
    icon: typeof CheckCircle2;
  }
> = {
  active: { label: "Active", variant: "positive", icon: CheckCircle2 },
  archived: { label: "Archived", variant: "neutral", icon: Archive },
  posted: { label: "Posted", variant: "positive", icon: CheckCircle2 },
  reversed: { label: "Reversed", variant: "warning", icon: RotateCcw },
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
