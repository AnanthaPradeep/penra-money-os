import { z } from "zod";

import { calendarDateSchema } from "@/lib/dates/schema";
import {
  nonNegativeMoneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/money/schema";
import {
  AGE_BANDS,
  INCOME_CATEGORIES,
  INCOME_SOURCE_TYPES,
  RECONCILIATION_SOURCES,
  RECONCILIATION_STATUSES,
  RESIDENTIAL_STATUSES,
  TAX_ASSET_CLASSES,
  TAX_PAYMENT_TYPES,
  TAX_REGIMES,
  WITHHOLDING_RECONCILIATION_STATUSES,
  WITHHOLDING_TYPES,
} from "@/lib/tax/mapping";

/** A financial-year id in canonical "YYYY-YY" form, e.g. "2025-26". */
export const financialYearIdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Enter a financial year like 2025-26.");

const optionalString = (maxLength: number) =>
  z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.string().max(maxLength)]));

const optionalUuid = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.uuid()]));

const optionalMoney = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), nonNegativeMoneyInputSchema]));

export const taxProfileSchema = z.object({
  residentialStatus: z.enum(RESIDENTIAL_STATUSES, {
    error: "Choose a residential status.",
  }),
  hasBusinessOrProfessionalIncome: z
    .string()
    .optional()
    .transform((raw) => raw === "true"),
  hasSalaryOrPensionIncome: z
    .string()
    .optional()
    .transform((raw) => raw === "true"),
  defaultRegimePreference: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.enum(TAX_REGIMES)])),
  ageBand: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.enum(AGE_BANDS)])),
  // At most the last 4 characters of a PAN — never a full PAN, never Aadhaar.
  maskedPanLabel: z
    .string()
    .optional()
    .transform((raw) =>
      raw && raw.trim().length > 0 ? raw.trim().toUpperCase() : undefined,
    )
    .pipe(
      z.union([
        z.undefined(),
        z
          .string()
          .max(
            4,
            "Enter at most the last 4 characters of your PAN — never the full number.",
          )
          .regex(/^[A-Z0-9]{1,4}$/, "Enter up to 4 letters/digits only."),
      ]),
    ),
  notes: optionalString(2000),
});
export type TaxProfileInput = z.infer<typeof taxProfileSchema>;

export const taxIncomeAdjustmentSchema = z.object({
  financialYearId: financialYearIdSchema,
  category: z.enum(INCOME_CATEGORIES, { error: "Choose an income category." }),
  grossAmount: nonNegativeMoneyInputSchema,
  tdsAmount: optionalMoney,
  isExemptCandidate: z
    .string()
    .optional()
    .transform((raw) => raw === "true"),
  sourceType: z.enum(INCOME_SOURCE_TYPES).default("manual"),
  sourceLedgerTransactionId: optionalUuid,
  sourceInvestmentActivityId: optionalUuid,
  evidenceLabel: optionalString(300),
  notes: optionalString(2000),
});
export type TaxIncomeAdjustmentInput = z.infer<
  typeof taxIncomeAdjustmentSchema
>;

export const taxDeductionSchema = z.object({
  financialYearId: financialYearIdSchema,
  section: z.string().trim().min(1, "Enter a deduction section.").max(40),
  claimedAmount: positiveMoneyInputSchema,
  evidenceLabel: optionalString(300),
  maskedReference: optionalString(60),
  sourceUrl: optionalString(500),
  notes: optionalString(2000),
});
export type TaxDeductionInput = z.infer<typeof taxDeductionSchema>;

export const taxWithholdingSchema = z.object({
  financialYearId: financialYearIdSchema,
  withholdingType: z.enum(WITHHOLDING_TYPES, {
    error: "Choose a withholding type.",
  }),
  deductorName: z.string().trim().min(1, "Enter the deductor's name.").max(200),
  grossAmount: nonNegativeMoneyInputSchema,
  taxWithheld: nonNegativeMoneyInputSchema,
  withheldOn: calendarDateSchema,
  maskedTan: z
    .string()
    .optional()
    .transform((raw) =>
      raw && raw.trim().length > 0 ? raw.trim().toUpperCase() : undefined,
    )
    .pipe(
      z.union([
        z.undefined(),
        z
          .string()
          .max(4, "Enter at most 4 characters.")
          .regex(/^[A-Z0-9]{1,4}$/),
      ]),
    ),
  incomeCategory: optionalString(100),
  referenceLabel: optionalString(100),
  evidenceSource: optionalString(300),
  notes: optionalString(2000),
});
export type TaxWithholdingInput = z.infer<typeof taxWithholdingSchema>;

export const taxPaymentSchema = z.object({
  financialYearId: financialYearIdSchema,
  paymentType: z.enum(TAX_PAYMENT_TYPES, { error: "Choose a payment type." }),
  amount: positiveMoneyInputSchema,
  paidOn: calendarDateSchema,
  challanReference: optionalString(100),
  relatedTransactionId: optionalUuid,
  notes: optionalString(2000),
});
export type TaxPaymentInput = z.infer<typeof taxPaymentSchema>;

export const taxAssetClassificationSchema = z
  .object({
    investmentAssetId: z.uuid(),
    assetClass: z.enum(TAX_ASSET_CLASSES, {
      error: "Choose an asset classification.",
    }),
    unsupportedReason: optionalString(500),
    notes: optionalString(1000),
  })
  .refine(
    (data) =>
      (data.assetClass === "unsupported") ===
      (data.unsupportedReason !== undefined),
    {
      error:
        "Explain why this asset is unsupported for automated capital gains.",
      path: ["unsupportedReason"],
    },
  );
export type TaxAssetClassificationInput = z.infer<
  typeof taxAssetClassificationSchema
>;

export const taxReconciliationItemSchema = z.object({
  financialYearId: financialYearIdSchema,
  source: z.enum(RECONCILIATION_SOURCES, { error: "Choose a source." }),
  incomeCategory: z
    .string()
    .trim()
    .min(1, "Enter an income category.")
    .max(100),
  reportedAmount: optionalMoney,
  processedAmount: optionalMoney,
  penraAmount: optionalMoney,
  acceptedAmount: optionalMoney,
  status: z.enum(RECONCILIATION_STATUSES).default("unreviewed"),
  explanation: optionalString(2000),
  evidenceSource: optionalString(300),
  evidenceDate: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), calendarDateSchema])),
});
export type TaxReconciliationItemInput = z.infer<
  typeof taxReconciliationItemSchema
>;

export const withholdingReconciliationStatusSchema = z.enum(
  WITHHOLDING_RECONCILIATION_STATUSES,
);
