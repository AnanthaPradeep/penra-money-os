import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/Badge";
import type { CorporateEventStatus } from "@/lib/corporate-events/types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export const CORPORATE_EVENT_STATUS_VARIANTS: Record<
  CorporateEventStatus,
  BadgeVariant
> = {
  scheduled: "info",
  confirmed: "positive",
  completed: "neutral",
  postponed: "warning",
  cancelled: "negative",
};
