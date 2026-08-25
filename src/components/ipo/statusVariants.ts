import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/Badge";
import type {
  IpoResearchPriority,
  IpoResearchStatus,
  IpoStatus,
} from "@/lib/ipo/types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Colour mappings for the IPO lifecycle/research enums — mirrors src/components/research/statusVariants.ts. Every state still carries a distinct text label alongside the colour, never colour alone. */
export const IPO_STATUS_VARIANTS: Record<IpoStatus, BadgeVariant> = {
  unknown: "neutral",
  draft_filed: "neutral",
  sebi_observation: "info",
  rhp_filed: "info",
  open: "positive",
  closed: "warning",
  allotment_pending: "warning",
  allotted: "primary",
  listed: "positive",
  withdrawn: "negative",
  cancelled: "negative",
};

export const IPO_RESEARCH_STATUS_VARIANTS: Record<
  IpoResearchStatus,
  BadgeVariant
> = {
  unreviewed: "neutral",
  researching: "info",
  watching: "primary",
  not_interested: "negative",
  review_complete: "positive",
  archived: "neutral",
};

export const IPO_RESEARCH_PRIORITY_VARIANTS: Record<
  IpoResearchPriority,
  BadgeVariant
> = {
  low: "neutral",
  medium: "info",
  high: "warning",
};
