import { z } from "zod";

import { AI_JOB_KINDS, AI_PROVIDERS, AI_SCOPE_TYPES } from "@/lib/ai/types";

export const addSourceDocumentChunkSchema = z
  .object({
    ipoDocumentId: z.uuid().optional(),
    companyFilingId: z.uuid().optional(),
    pageNumber: z.coerce.number().int().positive().optional(),
    sectionHeading: z.string().trim().max(200).optional(),
    contentText: z
      .string()
      .trim()
      .min(1, "Paste the excerpt you transcribed.")
      .max(8000),
  })
  .superRefine((data, ctx) => {
    const parentCount =
      (data.ipoDocumentId ? 1 : 0) + (data.companyFilingId ? 1 : 0);
    if (parentCount !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["ipoDocumentId"],
        message: "Link the excerpt to exactly one document or filing.",
      });
    }
  });
export type AddSourceDocumentChunkInput = z.infer<
  typeof addSourceDocumentChunkSchema
>;

/**
 * Mirrors ai_jobs_scope_consistent exactly, as defence-in-depth client-side
 * validation — the database CHECK constraint remains the authoritative
 * enforcement.
 */
export const createAiJobSchema = z
  .object({
    jobKind: z.enum(AI_JOB_KINDS),
    provider: z.enum(AI_PROVIDERS),
    modelId: z.string().trim().min(1).max(100),
    scopeType: z.enum(AI_SCOPE_TYPES),
    scopeInstrumentId: z.uuid().optional(),
    scopeIpoIssueId: z.uuid().optional(),
    scopeCompareInstrumentIds: z.array(z.uuid()).min(2).max(5).optional(),
    questionText: z.string().trim().max(2000).optional(),
    chunkIds: z.array(z.uuid()).max(50).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.scopeType === "company" && !data.scopeInstrumentId) {
      ctx.addIssue({
        code: "custom",
        path: ["scopeInstrumentId"],
        message: "A company scope needs an instrument.",
      });
    }
    if (data.scopeType === "ipo" && !data.scopeIpoIssueId) {
      ctx.addIssue({
        code: "custom",
        path: ["scopeIpoIssueId"],
        message: "An IPO scope needs an IPO.",
      });
    }
    if (
      data.scopeType === "comparison" &&
      (!data.scopeCompareInstrumentIds ||
        data.scopeCompareInstrumentIds.length < 2)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["scopeCompareInstrumentIds"],
        message: "A comparison scope needs 2-5 instruments.",
      });
    }
    if (data.jobKind === "research_question" && !data.questionText) {
      ctx.addIssue({
        code: "custom",
        path: ["questionText"],
        message: "Enter your research question.",
      });
    }
  });
export type CreateAiJobInput = z.infer<typeof createAiJobSchema>;

export const acceptAiJobOutputSchema = z.object({
  outputId: z.uuid(),
  editedContent: z.string().trim().max(8000).optional(),
});

export const rejectAiJobSchema = z.object({
  jobId: z.uuid(),
});
