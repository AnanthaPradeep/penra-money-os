import { z } from "zod";

import { calendarDateSchema } from "@/lib/dates/schema";
import {
  DEBT_INTEREST_METHODS,
  DEBT_PAYMENT_FREQUENCIES,
  DEBT_TYPES,
  PREPAYMENT_ASSUMPTIONS,
} from "@/lib/debts/mapping";
import {
  nonNegativeMoneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/money/schema";

export const debtNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a name for this debt.")
  .max(100, "Name must be 100 characters or fewer.");

/** A "" | numeric-string form field that parses to an optional integer in [min, max] — avoids z.coerce.number() inside a z.union(), which zod v4 cannot type-check through .pipe(). */
function optionalIntegerInput(min: number, max: number, message: string) {
  return z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .transform((raw, ctx) => {
      if (raw === undefined) {
        return undefined;
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return parsed;
    });
}

export const debtNotesSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().max(2000, "Notes must be 2000 characters or fewer."),
    ]),
  );

const optionalDate = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), calendarDateSchema]));

export const createDebtSchema = z
  .object({
    name: debtNameSchema,
    debtType: z.enum(DEBT_TYPES, { error: "Choose a debt type." }),
    liabilityAccountId: z.uuid("Choose a liability account."),
    originalPrincipal: positiveMoneyInputSchema,
    startDate: calendarDateSchema,
    currency: z.literal("INR").default("INR"),
    annualInterestRate: z
      .string()
      .optional()
      .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : "0"))
      .pipe(nonNegativeMoneyInputSchema)
      .refine((value) => value.lte(100), {
        error: "Interest rate must be 100% or less.",
      }),
    interestMethod: z.enum(DEBT_INTEREST_METHODS).default("reducing_balance"),
    paymentFrequency: z.enum(DEBT_PAYMENT_FREQUENCIES).default("monthly"),
    contractualEndDate: optionalDate,
    minimumPayment: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), positiveMoneyInputSchema])),
    dueDay: optionalIntegerInput(1, 31, "Enter a day between 1 and 31."),
    notes: debtNotesSchema,
  })
  .refine(
    (data) =>
      data.contractualEndDate === undefined ||
      data.contractualEndDate >= data.startDate,
    {
      error: "End date must be on or after the start date.",
      path: ["contractualEndDate"],
    },
  );
export type CreateDebtInput = z.infer<typeof createDebtSchema>;

export const debtStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "paid_off",
  "closed",
  "defaulted",
  "archived",
]);

export const recordDebtProceedsSchema = z.object({
  receivingAccountId: z.uuid("Choose a receiving account."),
  amount: positiveMoneyInputSchema,
  occurredOn: calendarDateSchema,
  idempotencyKey: z.uuid(),
});
export type RecordDebtProceedsInput = z.infer<typeof recordDebtProceedsSchema>;

export const changeDebtRateSchema = z.object({
  annualInterestRate: nonNegativeMoneyInputSchema.refine(
    (value) => value.lte(100),
    { error: "Interest rate must be 100% or less." },
  ),
  effectiveDate: calendarDateSchema,
  notes: debtNotesSchema,
});
export type ChangeDebtRateInput = z.infer<typeof changeDebtRateSchema>;

export const regenerateScheduleSchema = z.object({
  installmentCount: z.coerce.number().int().min(1).max(600),
  installmentPayment: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), positiveMoneyInputSchema])),
});
export type RegenerateScheduleInput = z.infer<typeof regenerateScheduleSchema>;

export const recordDebtPaymentSchema = z
  .object({
    principalAmount: nonNegativeMoneyInputSchema,
    interestAmount: nonNegativeMoneyInputSchema,
    feesAmount: nonNegativeMoneyInputSchema,
    paymentAccountId: z.uuid("Choose a payment account."),
    effectiveDate: calendarDateSchema,
    idempotencyKey: z.uuid(),
    paymentType: z.enum(["scheduled", "prepayment"]).default("scheduled"),
    scheduleRowId: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), z.uuid()])),
    prepaymentAssumption: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), z.enum(PREPAYMENT_ASSUMPTIONS)])),
    allowOverpayment: z.coerce.boolean().default(false),
  })
  .refine(
    (data) =>
      data.principalAmount
        .plus(data.interestAmount)
        .plus(data.feesAmount)
        .gt(0),
    {
      error: "Enter at least one non-zero payment component.",
      path: ["principalAmount"],
    },
  );
export type RecordDebtPaymentInput = z.infer<typeof recordDebtPaymentSchema>;
