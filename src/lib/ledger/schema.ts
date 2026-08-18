import { z } from "zod";

import { transactionDateSchema } from "@/lib/dates/schema";
import { positiveMoneyInputSchema } from "@/lib/money/schema";

export const transactionDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Please enter a description.")
  .max(200, "Description must be 200 characters or fewer.");

export const transactionNotesSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().max(2000, "Notes must be 2000 characters or fewer."),
    ]),
  );

const accountIdSchema = z.uuid("Choose a valid account.");

export const incomeTransactionSchema = z.object({
  toAccountId: accountIdSchema,
  amount: positiveMoneyInputSchema,
  occurredOn: transactionDateSchema,
  description: transactionDescriptionSchema,
  notes: transactionNotesSchema,
});
export type IncomeTransactionInput = z.infer<typeof incomeTransactionSchema>;

export const expenseTransactionSchema = z.object({
  fromAccountId: accountIdSchema,
  amount: positiveMoneyInputSchema,
  occurredOn: transactionDateSchema,
  description: transactionDescriptionSchema,
  notes: transactionNotesSchema,
});
export type ExpenseTransactionInput = z.infer<typeof expenseTransactionSchema>;

export const transferTransactionSchema = z
  .object({
    fromAccountId: accountIdSchema,
    toAccountId: accountIdSchema,
    amount: positiveMoneyInputSchema,
    occurredOn: transactionDateSchema,
    description: transactionDescriptionSchema,
    notes: transactionNotesSchema,
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    error: "Choose two different accounts.",
    path: ["toAccountId"],
  });
export type TransferTransactionInput = z.infer<
  typeof transferTransactionSchema
>;

export const creditCardPurchaseSchema = z.object({
  creditCardAccountId: accountIdSchema,
  amount: positiveMoneyInputSchema,
  occurredOn: transactionDateSchema,
  description: transactionDescriptionSchema,
  notes: transactionNotesSchema,
});
export type CreditCardPurchaseInput = z.infer<typeof creditCardPurchaseSchema>;

export const creditCardPaymentSchema = z
  .object({
    creditCardAccountId: accountIdSchema,
    fromAccountId: accountIdSchema,
    amount: positiveMoneyInputSchema,
    occurredOn: transactionDateSchema,
    description: transactionDescriptionSchema,
    notes: transactionNotesSchema,
  })
  .refine((data) => data.fromAccountId !== data.creditCardAccountId, {
    error: "Choose two different accounts.",
    path: ["fromAccountId"],
  });
export type CreditCardPaymentInput = z.infer<typeof creditCardPaymentSchema>;
