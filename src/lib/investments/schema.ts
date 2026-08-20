import { z } from "zod";

import { calendarDateSchema, transactionDateSchema } from "@/lib/dates/schema";
import {
  parseOptionalSignedDecimalInput,
  parsePositiveQuantityInput,
} from "@/lib/investments/parse";
import {
  COMPOUNDING_FREQUENCIES,
  FIXED_INCOME_STATUSES,
  INTEREST_PAYOUT_MODES,
  INVESTMENT_ASSET_KINDS,
  INVESTMENT_ASSET_STATUSES,
  INVESTMENT_HOLDING_STATUSES,
} from "@/lib/investments/types";
import { RECURRENCE_FREQUENCIES } from "@/lib/recurring/schedule";
import { PROCESSING_MODES } from "@/lib/recurring/types";
import {
  nonNegativeMoneyInputSchema,
  optionalPositiveMoneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/money/schema";

const idempotencyKeySchema = z.uuid();
const uuidRequired = z.uuid("Choose a valid option.");
const uuidOrBlank = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.uuid("Choose a valid option.")]));

/** Same digit rules as positiveMoneyInputSchema, but up to 6 fractional digits — for a unit quantity or unit price. */
export const positiveQuantityInputSchema = z.string().transform((raw, ctx) => {
  const result = parsePositiveQuantityInput(raw);
  if (!result.success) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.value;
});

/** A signed correction delta (may be negative), blank-is-absent — used only by the adjustment schema below. */
const signedDecimalOrBlankSchema = z.string().transform((raw, ctx) => {
  const result = parseOptionalSignedDecimalInput(raw);
  if (!result.success) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.value;
});

/** An annual interest rate as a reference percentage, 0-100 with up to 4 decimal places — never a live/authoritative rate. */
export const interestRateInputSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z
        .string()
        .regex(/^\d{1,3}(\.\d{1,4})?$/, "Enter a rate between 0 and 100.")
        .refine((v) => Number(v) <= 100, "Enter a rate between 0 and 100."),
    ]),
  );

export const investmentAssetSchema = z.object({
  assetKind: z.enum(INVESTMENT_ASSET_KINDS, { error: "Choose a kind." }),
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(160, "Name must be 160 characters or fewer."),
  symbol: z
    .string()
    .trim()
    .max(40, "Symbol must be 40 characters or fewer.")
    .optional(),
  exchange: z
    .string()
    .trim()
    .max(40, "Exchange must be 40 characters or fewer.")
    .optional(),
  isin: z
    .string()
    .trim()
    .max(20, "ISIN must be 20 characters or fewer.")
    .optional(),
  schemeCode: z
    .string()
    .trim()
    .max(40, "Scheme code must be 40 characters or fewer.")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be 2000 characters or fewer.")
    .optional(),
});
export type InvestmentAssetInput = z.infer<typeof investmentAssetSchema>;

export const updateInvestmentAssetSchema = investmentAssetSchema.omit({
  assetKind: true,
});

export const investmentHoldingSchema = z.object({
  investmentAssetId: uuidRequired,
  investmentAccountId: uuidOrBlank,
  openedDate: calendarDateSchema,
});
export type InvestmentHoldingInput = z.infer<typeof investmentHoldingSchema>;

// ---------------------------------------------------------------------
// Activity forms — one Zod object per activity kind, combined into a
// discriminated union on `activityKind`.
// ---------------------------------------------------------------------

export const purchaseActivitySchema = z.object({
  activityKind: z.literal("buy"),
  fundingAccountId: uuidRequired,
  tradeDate: transactionDateSchema,
  quantity: positiveQuantityInputSchema,
  unitPrice: positiveQuantityInputSchema,
  feeAmount: nonNegativeMoneyInputSchema.optional(),
  settlementDate: calendarDateSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const saleActivitySchema = z.object({
  activityKind: z.literal("sell"),
  receivingAccountId: uuidRequired,
  tradeDate: transactionDateSchema,
  quantity: positiveQuantityInputSchema,
  unitPrice: positiveQuantityInputSchema,
  feeAmount: nonNegativeMoneyInputSchema.optional(),
  taxAmount: nonNegativeMoneyInputSchema.optional(),
  settlementDate: calendarDateSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const contributionActivitySchema = z.object({
  activityKind: z.literal("contribution"),
  fundingAccountId: uuidRequired,
  tradeDate: transactionDateSchema,
  grossAmount: positiveMoneyInputSchema,
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const withdrawalActivitySchema = z.object({
  activityKind: z.literal("withdrawal"),
  receivingAccountId: uuidRequired,
  tradeDate: transactionDateSchema,
  grossAmount: positiveMoneyInputSchema,
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

// Split into two pure-literal-discriminant schemas (rather than one
// schema with `z.enum(["dividend", "interest"])`) so TypeScript's control-
// flow narrowing on `investmentActivitySchema`'s discriminated union
// output stays exact through every `data.activityKind === "..."` branch
// in src/lib/investments/actions.ts — an enum discriminant confuses
// narrowing in later `else` branches even though Zod itself accepts it.
const incomeActivityFields = {
  receivingAccountId: uuidRequired,
  tradeDate: transactionDateSchema,
  grossAmount: positiveMoneyInputSchema,
  categoryId: uuidRequired,
  payeeId: uuidOrBlank,
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
};
export const dividendActivitySchema = z.object({
  activityKind: z.literal("dividend"),
  ...incomeActivityFields,
});
export const interestActivitySchema = z.object({
  activityKind: z.literal("interest"),
  ...incomeActivityFields,
});

export const feeActivitySchema = z.object({
  activityKind: z.literal("fee"),
  fundingAccountId: uuidRequired,
  tradeDate: transactionDateSchema,
  grossAmount: positiveMoneyInputSchema,
  categoryId: uuidOrBlank,
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const adjustmentActivitySchema = z
  .object({
    activityKind: z.literal("adjustment"),
    tradeDate: calendarDateSchema,
    notes: z
      .string()
      .trim()
      .min(10, "Explain the correction in at least 10 characters."),
    quantityDelta: signedDecimalOrBlankSchema.optional(),
    costBasisDelta: signedDecimalOrBlankSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.quantityDelta === undefined && data.costBasisDelta === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["quantityDelta"],
        message: "Enter a quantity delta, a cost-basis delta, or both.",
      });
    }
  });

/** Discriminated union covering every activity-composer form. Reversal/valuation are separate, simpler flows (see below) since neither is a "compose a new activity" form. */
export const investmentActivitySchema = z.discriminatedUnion("activityKind", [
  purchaseActivitySchema,
  saleActivitySchema,
  contributionActivitySchema,
  withdrawalActivitySchema,
  dividendActivitySchema,
  interestActivitySchema,
  feeActivitySchema,
  adjustmentActivitySchema,
]);
export type InvestmentActivityInput = z.infer<typeof investmentActivitySchema>;

export const manualValuationSchema = z.object({
  valuedAt: transactionDateSchema,
  totalValue: nonNegativeMoneyInputSchema,
  unitValue: optionalPositiveMoneyInputSchema,
  note: z.string().trim().max(1000).optional(),
});
export type ManualValuationInput = z.infer<typeof manualValuationSchema>;

// ---------------------------------------------------------------------
// Fixed-income (PPF/FD/RD) schemas.
// ---------------------------------------------------------------------

export const ppfAccountSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a name.").max(160),
  investmentAccountId: uuidRequired,
  provider: z.string().trim().max(160).optional(),
  startDate: calendarDateSchema,
  maturityDate: calendarDateSchema.optional(),
  interestRate: interestRateInputSchema,
  notes: z.string().trim().max(2000).optional(),
  openingContributionAmount: optionalPositiveMoneyInputSchema,
  openingContributionFundingAccountId: uuidOrBlank,
  openingContributionIdempotencyKey: idempotencyKeySchema.optional(),
});
export type PpfAccountInput = z.infer<typeof ppfAccountSchema>;

export const fixedDepositSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a name.").max(160),
  investmentAccountId: uuidRequired,
  fundingAccountId: uuidRequired,
  principalAmount: positiveMoneyInputSchema,
  startDate: calendarDateSchema,
  maturityDate: calendarDateSchema,
  provider: z.string().trim().max(160).optional(),
  interestRate: interestRateInputSchema,
  compoundingFrequency: z.enum(COMPOUNDING_FREQUENCIES).optional(),
  interestPayoutMode: z.enum(INTEREST_PAYOUT_MODES).optional(),
  expectedMaturityAmount: optionalPositiveMoneyInputSchema,
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});
export type FixedDepositInput = z.infer<typeof fixedDepositSchema>;

export const matureFixedDepositSchema = z.object({
  receivingAccountId: uuidRequired,
  actualMaturityAmount: nonNegativeMoneyInputSchema,
  maturityDate: transactionDateSchema,
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});
export type MatureFixedDepositInput = z.infer<typeof matureFixedDepositSchema>;

export const recurringDepositSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a name.").max(160),
  investmentAccountId: uuidRequired,
  fundingAccountId: uuidRequired,
  installmentAmount: positiveMoneyInputSchema,
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  intervalCount: z.coerce.number().int().min(1).default(1),
  startDate: calendarDateSchema,
  maturityDate: calendarDateSchema,
  provider: z.string().trim().max(160).optional(),
  interestRate: interestRateInputSchema,
  plannedInstallments: z.coerce.number().int().min(1).optional(),
  expectedMaturityAmount: optionalPositiveMoneyInputSchema,
  processingMode: z.enum(PROCESSING_MODES),
  notes: z.string().trim().max(2000).optional(),
});
export type RecurringDepositInput = z.infer<typeof recurringDepositSchema>;

export const setFixedIncomeStatusSchema = z.object({
  status: z.enum(FIXED_INCOME_STATUSES),
});

export const setInvestmentAssetStatusSchema = z.object({
  status: z.enum(INVESTMENT_ASSET_STATUSES),
});

export const setInvestmentHoldingStatusSchema = z.object({
  status: z.enum(INVESTMENT_HOLDING_STATUSES),
});
