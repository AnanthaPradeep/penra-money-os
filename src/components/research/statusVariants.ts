import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/Badge";
import type {
  IdeaStatus,
  ResearchPriority,
  ResearchStatus,
  ThesisStatus,
} from "@/lib/research/types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Colour mappings for the research-domain status/priority enums — kept local to the research feature (rather than extending the shared StatusBadge component's fixed Status union, which mirrors ledger/recurring/investment lifecycle states, not these). Every state still carries a distinct text label alongside the colour, never colour alone. */
export const RESEARCH_STATUS_VARIANTS: Record<ResearchStatus, BadgeVariant> = {
  unreviewed: "neutral",
  researching: "info",
  watching: "primary",
  thesis_ready: "positive",
  rejected: "negative",
  archived: "neutral",
};

export const THESIS_STATUS_VARIANTS: Record<ThesisStatus, BadgeVariant> = {
  draft: "neutral",
  active: "positive",
  needs_review: "warning",
  invalidated: "negative",
  closed: "neutral",
  archived: "neutral",
};

export const IDEA_STATUS_VARIANTS: Record<IdeaStatus, BadgeVariant> = {
  captured: "neutral",
  researching: "info",
  watching: "primary",
  rejected: "negative",
  approved_for_manual_action: "positive",
  closed: "neutral",
  archived: "neutral",
};

export const PRIORITY_VARIANTS: Record<ResearchPriority, BadgeVariant> = {
  low: "neutral",
  medium: "info",
  high: "warning",
};

export const PRIORITY_LABELS: Record<ResearchPriority, string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};
