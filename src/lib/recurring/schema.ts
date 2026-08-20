import { z } from "zod";

import { calendarDateSchema } from "@/lib/dates/schema";
import { positiveMoneyInputSchema } from "@/lib/money/schema";
import { RECURRENCE_FREQUENCIES } from "@/lib/recurring/schedule";
import { PROCESSING_MODES } from "@/lib/recurring/types";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a name.")
  .max(120, "Name must be 120 characters or fewer.");

const notesSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().max(2000, "Notes must be 2000 characters or fewer."),
    ]),
  );

const optionalPayeeIdSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.uuid("Choose a valid payee.")]));

const optionalEndDateSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), calendarDateSchema]));

const sharedRecurringFields = {
  name: nameSchema,
  amount: positiveMoneyInputSchema,
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  intervalCount: z.coerce.number().int().min(1).max(52),
  startDate: calendarDateSchema,
  endDate: optionalEndDateSchema,
  notes: notesSchema,
  processingMode: z.enum(PROCESSING_MODES),
};

export const recurringBillSchema = z
  .object({
    kind: z.literal("bill"),
    sourceAccountId: z.uuid("Choose an account."),
    categoryId: z.uuid("Choose a category."),
    payeeId: optionalPayeeIdSchema,
    ...sharedRecurringFields,
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    error: "End date must be on or after the start date.",
    path: ["endDate"],
  });
export type RecurringBillInput = z.infer<typeof recurringBillSchema>;

export const recurringSubscriptionSchema = z
  .object({
    kind: z.literal("subscription"),
    sourceAccountId: z.uuid("Choose an account."),
    categoryId: z.uuid("Choose a category."),
    payeeId: optionalPayeeIdSchema,
    trialEndDate: optionalEndDateSchema,
    ...sharedRecurringFields,
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    error: "End date must be on or after the start date.",
    path: ["endDate"],
  });
export type RecurringSubscriptionInput = z.infer<
  typeof recurringSubscriptionSchema
>;

export const recurringIncomeSchema = z
  .object({
    kind: z.literal("income"),
    destinationAccountId: z.uuid("Choose an account."),
    categoryId: z.uuid("Choose a category."),
    payeeId: optionalPayeeIdSchema,
    ...sharedRecurringFields,
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    error: "End date must be on or after the start date.",
    path: ["endDate"],
  });
export type RecurringIncomeInput = z.infer<typeof recurringIncomeSchema>;

export const recurringTransferSchema = z
  .object({
    kind: z.literal("transfer"),
    sourceAccountId: z.uuid("Choose an account."),
    destinationAccountId: z.uuid("Choose an account."),
    ...sharedRecurringFields,
  })
  .refine((data) => data.sourceAccountId !== data.destinationAccountId, {
    error: "Choose two different accounts.",
    path: ["destinationAccountId"],
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    error: "End date must be on or after the start date.",
    path: ["endDate"],
  });
export type RecurringTransferInput = z.infer<typeof recurringTransferSchema>;

export const recurringItemSchema = z.discriminatedUnion("kind", [
  recurringBillSchema,
  recurringSubscriptionSchema,
  recurringIncomeSchema,
  recurringTransferSchema,
]);
export type RecurringItemInput = z.infer<typeof recurringItemSchema>;

/** Editable fields only (see update_recurring_item, supabase/migrations, for why kind/accounts/currency/startDate are fixed after creation). */
export const updateRecurringItemSchema = z.object({
  name: nameSchema,
  amount: positiveMoneyInputSchema,
  categoryId: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.uuid("Choose a valid category.")])),
  payeeId: optionalPayeeIdSchema,
  notes: notesSchema,
  endDate: optionalEndDateSchema,
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  intervalCount: z.coerce.number().int().min(1).max(52),
  processingMode: z.enum(PROCESSING_MODES),
});
export type UpdateRecurringItemInput = z.infer<
  typeof updateRecurringItemSchema
>;
