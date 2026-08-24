import { z } from "zod";

import { calendarDateSchema } from "@/lib/dates/schema";
import {
  CONFIDENCE_LEVELS,
  FILING_CATEGORIES,
  IDEA_STATUSES,
  NOTE_TYPES,
  RESEARCH_PRIORITIES,
  RESEARCH_STATUSES,
  THESIS_STATUSES,
  TIME_HORIZONS,
  WATCHLIST_COLORS,
  WATCHLIST_ICONS,
  WATCHLIST_STATUSES,
} from "@/lib/research/types";
import { validateSourceUrl } from "@/lib/research/url";

const uuidRequired = z.uuid("Choose a valid option.");
const uuidOrBlank = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.uuid("Choose a valid option.")]));

/** A source URL, blank-is-absent, validated with the SSRF-safe/HTTPS-only rules in src/lib/research/url.ts. */
const optionalSourceUrlSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().transform((raw, ctx) => {
        const result = validateSourceUrl(raw);
        if (!result.success) {
          ctx.addIssue({ code: "custom", message: result.error });
          return z.NEVER;
        }
        return result.url;
      }),
    ]),
  );

const requiredSourceUrlSchema = z.string().transform((raw, ctx) => {
  const result = validateSourceUrl(raw);
  if (!result.success) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.url;
});

export const watchlistSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  description: z.string().trim().max(1000).optional(),
  color: z.enum(WATCHLIST_COLORS).default("slate"),
  icon: z.enum(WATCHLIST_ICONS).default("star"),
});
export type WatchlistInput = z.infer<typeof watchlistSchema>;

export const updateWatchlistStatusSchema = z.object({
  status: z.enum(WATCHLIST_STATUSES),
});

export const watchlistItemSchema = z.object({
  watchlistId: uuidRequired,
  instrumentId: uuidRequired,
  priority: z.enum(RESEARCH_PRIORITIES).default("medium"),
  targetReviewDate: calendarDateSchema.optional(),
});
export type WatchlistItemInput = z.infer<typeof watchlistItemSchema>;

export const updateWatchlistItemSchema = z.object({
  priority: z.enum(RESEARCH_PRIORITIES).optional(),
  targetReviewDate: calendarDateSchema.optional(),
  researchStatus: z.enum(RESEARCH_STATUSES).optional(),
});

export const researchNoteSchema = z.object({
  instrumentId: uuidRequired,
  title: z.string().trim().min(1, "Enter a title.").max(200),
  body: z.string().trim().min(1, "Enter some content.").max(20000),
  noteType: z.enum(NOTE_TYPES).default("general"),
  sourceUrl: optionalSourceUrlSchema,
  filingId: uuidOrBlank,
  observedDate: calendarDateSchema.optional(),
});
export type ResearchNoteInput = z.infer<typeof researchNoteSchema>;

export const updateResearchNoteSchema = researchNoteSchema
  .omit({ instrumentId: true })
  .extend({
    isPinned: z.coerce.boolean().optional(),
    isArchived: z.coerce.boolean().optional(),
  });

export const companyFilingSchema = z.object({
  instrumentId: uuidRequired,
  category: z.enum(FILING_CATEGORIES).default("other"),
  title: z.string().trim().min(1, "Enter a title.").max(200),
  filingDate: calendarDateSchema.optional(),
  sourceUrl: requiredSourceUrlSchema,
  notes: z.string().trim().max(2000).optional(),
});
export type CompanyFilingInput = z.infer<typeof companyFilingSchema>;

export const investmentThesisSchema = z.object({
  instrumentId: uuidRequired,
  title: z.string().trim().min(1, "Enter a title.").max(200),
  summary: z.string().trim().max(4000).optional(),
  investmentCase: z.string().trim().max(8000).optional(),
  opportunities: z.string().trim().max(4000).optional(),
  risks: z.string().trim().max(4000).optional(),
  catalysts: z.string().trim().max(4000).optional(),
  invalidationConditions: z.string().trim().max(4000).optional(),
  expectedReviewDate: calendarDateSchema.optional(),
  timeHorizon: z.enum(TIME_HORIZONS).default("medium_term"),
  confidence: z.enum(CONFIDENCE_LEVELS).default("medium"),
  status: z.enum(THESIS_STATUSES).default("draft"),
});
export type InvestmentThesisInput = z.infer<typeof investmentThesisSchema>;

export const updateInvestmentThesisSchema = investmentThesisSchema.omit({
  instrumentId: true,
});

export const investmentIdeaSchema = z.object({
  instrumentId: uuidRequired,
  title: z.string().trim().min(1, "Enter a title.").max(200),
  priority: z.enum(RESEARCH_PRIORITIES).default("medium"),
  origin: z.string().trim().max(200).optional(),
  rationale: z.string().trim().max(4000).optional(),
  riskNotes: z.string().trim().max(4000).optional(),
  nextReviewDate: calendarDateSchema.optional(),
  thesisId: uuidOrBlank,
});
export type InvestmentIdeaInput = z.infer<typeof investmentIdeaSchema>;

export const updateInvestmentIdeaSchema = investmentIdeaSchema
  .omit({ instrumentId: true })
  .extend({
    status: z.enum(IDEA_STATUSES).optional(),
  });
