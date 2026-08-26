import { z } from "zod";

import {
  nonNegativeMoneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/money/schema";
import { calendarDateSchema } from "@/lib/dates/schema";
import { INCOME_ALLOCATION_MODES } from "@/lib/wallets/mapping";

export const walletNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a wallet name.")
  .max(80, "Wallet name must be 80 characters or fewer.");

export const walletDescriptionSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().max(500, "Description must be 500 characters or fewer."),
    ]),
  );

export const walletColorSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().regex(/^#[0-9a-fA-F]{6}$/, "Enter a valid hex color."),
    ]),
  );

export const walletIconSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.string().max(40)]));

export const walletFundingModeSchema = z.enum(["earmarked", "planning_only"], {
  error: "Choose how this wallet is funded.",
});

export const createPurposeWalletSchema = z.object({
  name: walletNameSchema,
  currency: z.literal("INR").default("INR"),
  icon: walletIconSchema,
  color: walletColorSchema,
  description: walletDescriptionSchema,
  priority: z.coerce.number().int().min(0).max(100).default(0),
  targetAmount: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), positiveMoneyInputSchema])),
  fundingMode: walletFundingModeSchema.default("earmarked"),
});
export type CreatePurposeWalletInput = z.infer<
  typeof createPurposeWalletSchema
>;

export const updatePurposeWalletSchema = z.object({
  name: walletNameSchema,
  icon: walletIconSchema,
  color: walletColorSchema,
  description: walletDescriptionSchema,
  priority: z.coerce.number().int().min(0).max(100).default(0),
  targetAmount: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), positiveMoneyInputSchema])),
});
export type UpdatePurposeWalletInput = z.infer<
  typeof updatePurposeWalletSchema
>;

export const walletAllocationSchema = z.object({
  amount: positiveMoneyInputSchema,
  memo: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.string().max(300, "Note is too long.")])),
});
export type WalletAllocationInput = z.infer<typeof walletAllocationSchema>;

export const walletReallocationSchema = z
  .object({
    fromWalletId: z.uuid("Choose a source wallet."),
    toWalletId: z.uuid("Choose a destination wallet."),
    amount: positiveMoneyInputSchema,
    memo: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), z.string().max(300, "Note is too long.")])),
  })
  .refine((data) => data.fromWalletId !== data.toWalletId, {
    error: "Choose two different wallets.",
    path: ["toWalletId"],
  });
export type WalletReallocationInput = z.infer<typeof walletReallocationSchema>;

export const assignTransactionWalletSchema = z.object({
  transactionId: z.uuid(),
  walletId: z.uuid("Choose a wallet."),
});
export type AssignTransactionWalletInput = z.infer<
  typeof assignTransactionWalletSchema
>;

const allocationPlanLineSchema = z
  .object({
    walletId: z.uuid("Choose a wallet."),
    percentage: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), nonNegativeMoneyInputSchema])),
    fixedAmount: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), positiveMoneyInputSchema])),
  })
  .refine(
    (line) => line.percentage !== undefined || line.fixedAmount !== undefined,
    {
      error: "Enter a percentage or a fixed amount for every line.",
      path: ["percentage"],
    },
  );

export const incomeAllocationPlanSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Please enter a plan name.")
      .max(100, "Plan name must be 100 characters or fewer."),
    allocationMode: z.enum(INCOME_ALLOCATION_MODES, {
      error: "Choose an allocation mode.",
    }),
    effectiveDate: calendarDateSchema,
    endDate: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), calendarDateSchema])),
    lines: z
      .array(allocationPlanLineSchema)
      .min(1, "Add at least one allocation line."),
  })
  .superRefine((data, ctx) => {
    if (data.allocationMode === "percentage") {
      const total = data.lines.reduce(
        (sum, line) => sum + Number(line.percentage ?? 0),
        0,
      );
      if (Math.round(total * 1000) / 1000 !== 100) {
        ctx.addIssue({
          code: "custom",
          path: ["lines"],
          message: `Percentage lines must total exactly 100% (currently ${total}%).`,
        });
      }
    }
    if (data.allocationMode === "fixed_amount") {
      const hasPercentage = data.lines.some(
        (line) => line.percentage !== undefined,
      );
      if (hasPercentage) {
        ctx.addIssue({
          code: "custom",
          path: ["lines"],
          message: "A fixed-amount plan cannot include percentage lines.",
        });
      }
    }
  });
export type IncomeAllocationPlanInput = z.infer<
  typeof incomeAllocationPlanSchema
>;

export const applyIncomeAllocationPlanSchema = z.object({
  planId: z.uuid("Choose a plan."),
  transactionId: z.uuid(),
});
export type ApplyIncomeAllocationPlanInput = z.infer<
  typeof applyIncomeAllocationPlanSchema
>;
