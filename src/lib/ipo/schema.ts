import { z } from "zod";

import { calendarDateSchema } from "@/lib/dates/schema";
import {
  IPO_BOARDS,
  IPO_DOCUMENT_TYPES,
  IPO_ISSUE_TYPES,
  IPO_METRIC_KEYS,
  IPO_RESEARCH_PRIORITIES,
  IPO_RESEARCH_STATUSES,
  IPO_SOURCE_ORGANIZATIONS,
  IPO_STATEMENT_BASES,
  IPO_STATUSES,
  IPO_UNIT_SCALES,
} from "@/lib/ipo/types";
import { validateOfficialIpoSourceUrl } from "@/lib/ipo/url";

export const addIpoSchema = z
  .object({
    issuerName: z.string().trim().min(1, "Enter the issuer name.").max(200),
    board: z.enum(IPO_BOARDS),
    sourceOrganization: z.enum(IPO_SOURCE_ORGANIZATIONS),
    sourceUrl: z.string().trim().min(1, "Enter a source URL."),
    cin: z.string().trim().max(30).optional(),
    isin: z.string().trim().max(20).optional(),
    exchange: z.string().trim().max(20).optional(),
    industry: z.string().trim().max(100).optional(),
    issueType: z.enum(IPO_ISSUE_TYPES).default("fresh_and_ofs"),
  })
  .superRefine((data, ctx) => {
    const result = validateOfficialIpoSourceUrl(
      data.sourceUrl,
      data.sourceOrganization,
    );
    if (!result.success) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: result.error,
      });
    }
  });
export type AddIpoInput = z.infer<typeof addIpoSchema>;

export const updateIpoFieldsSchema = z.object({
  status: z.enum(IPO_STATUSES).optional(),
  cin: z.string().trim().max(30).optional(),
  isin: z.string().trim().max(20).optional(),
  exchange: z.string().trim().max(20).optional(),
  industry: z.string().trim().max(100).optional(),
  freshIssueAmount: z.coerce.number().nonnegative().optional(),
  offerForSaleAmount: z.coerce.number().nonnegative().optional(),
  totalIssueSize: z.coerce.number().nonnegative().optional(),
  faceValue: z.coerce.number().positive().optional(),
  priceBandMin: z.coerce.number().positive().optional(),
  priceBandMax: z.coerce.number().positive().optional(),
  lotSize: z.coerce.number().int().positive().optional(),
  minApplicationQuantity: z.coerce.number().int().positive().optional(),
  issueOpenDate: calendarDateSchema.optional(),
  issueCloseDate: calendarDateSchema.optional(),
  anchorDate: calendarDateSchema.optional(),
  basisOfAllotmentDate: calendarDateSchema.optional(),
  refundDate: calendarDateSchema.optional(),
  dematCreditDate: calendarDateSchema.optional(),
  listingDate: calendarDateSchema.optional(),
  finalIssuePrice: z.coerce.number().positive().optional(),
});
export type UpdateIpoFieldsInput = z.infer<typeof updateIpoFieldsSchema>;

export const addIpoDocumentSchema = z
  .object({
    documentType: z.enum(IPO_DOCUMENT_TYPES),
    title: z.string().trim().min(1, "Enter a title.").max(200),
    sourceUrl: z.string().trim().min(1, "Enter a source URL."),
    sourceOrganization: z.enum(IPO_SOURCE_ORGANIZATIONS),
    filingDate: calendarDateSchema.optional(),
    sourcePageUrl: z.string().trim().max(2048).optional(),
  })
  .superRefine((data, ctx) => {
    const result = validateOfficialIpoSourceUrl(
      data.sourceUrl,
      data.sourceOrganization,
    );
    if (!result.success) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: result.error,
      });
    }
  });
export type AddIpoDocumentInput = z.infer<typeof addIpoDocumentSchema>;

export const addIpoFinancialMetricSchema = z.object({
  metricKey: z.enum(IPO_METRIC_KEYS),
  fiscalPeriodEnd: calendarDateSchema,
  value: z.coerce.number().finite(),
  statementBasis: z.enum(IPO_STATEMENT_BASES).default("consolidated"),
  unitScale: z.enum(IPO_UNIT_SCALES).default("unit"),
  currency: z.string().trim().length(3).default("INR"),
  sourceDocumentId: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.uuid()])),
  sourceCitation: z.string().trim().max(300).optional(),
});
export type AddIpoFinancialMetricInput = z.infer<
  typeof addIpoFinancialMetricSchema
>;

export const watchIpoSchema = z.object({
  ipoIssueId: z.uuid(),
  priority: z.enum(IPO_RESEARCH_PRIORITIES).default("medium"),
});

export const updateIpoWatchlistItemSchema = z.object({
  priority: z.enum(IPO_RESEARCH_PRIORITIES).optional(),
  researchStatus: z.enum(IPO_RESEARCH_STATUSES).optional(),
  targetReviewDate: calendarDateSchema.optional(),
});

const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string().max(200),
  checked: z.boolean(),
});

export const ipoResearchNoteSchema = z.object({
  ipoIssueId: z.uuid(),
  businessOverview: z.string().trim().max(4000).optional(),
  revenueModel: z.string().trim().max(4000).optional(),
  industryContext: z.string().trim().max(4000).optional(),
  promotersManagement: z.string().trim().max(4000).optional(),
  useOfProceeds: z.string().trim().max(4000).optional(),
  strengths: z.string().trim().max(4000).optional(),
  risks: z.string().trim().max(4000).optional(),
  materialLitigations: z.string().trim().max(4000).optional(),
  relatedPartyConcerns: z.string().trim().max(4000).optional(),
  concentrationRisk: z.string().trim().max(4000).optional(),
  debtNotes: z.string().trim().max(4000).optional(),
  cashFlowNotes: z.string().trim().max(4000).optional(),
  dilutionNotes: z.string().trim().max(4000).optional(),
  valuationObservations: z.string().trim().max(4000).optional(),
  unansweredQuestions: z.string().trim().max(4000).optional(),
  personalNote: z.string().trim().max(4000).optional(),
  riskChecklist: z.array(checklistItemSchema).max(50).optional(),
  sourceChecklist: z.array(checklistItemSchema).max(50).optional(),
});
export type IpoResearchNoteInput = z.infer<typeof ipoResearchNoteSchema>;
