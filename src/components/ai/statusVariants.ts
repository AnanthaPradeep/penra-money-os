import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/Badge";
import type { AiJobStatus } from "@/lib/ai/types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export const AI_JOB_STATUS_VARIANTS: Record<AiJobStatus, BadgeVariant> = {
  queued: "neutral",
  processing: "info",
  completed: "positive",
  failed: "negative",
  cancelled: "neutral",
  blocked: "warning",
};
