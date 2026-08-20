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
const categoryIdSchema = z.uuid("Choose a category.");
const optionalPayeeIdSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.uuid("Choose a valid payee.")]));

/**
 * Generated client-side once per form mount and resubmitted unchanged on
 * every retry of that same submission — the server-side half of "no
 * duplicate transaction from a duplicate submission" (see
 * create_manual_transaction's p_idempotency_key, which reuses
 * ledger_transactions.source_reference's existing per-user unique index).
 */
export const idempotencyKeySchema = z.uuid();

export const incomeTransactionSchema = z.object({
  toAccountId: accountIdSchema,
  categoryId: categoryIdSchema,
  amount: positiveMoneyInputSchema,
  occurredOn: transactionDateSchema,
  description: transactionDescriptionSchema,
  payeeId: optionalPayeeIdSchema,
  notes: transactionNotesSchema,
  idempotencyKey: idempotencyKeySchema,
});
export type IncomeTransactionInput = z.infer<typeof incomeTransactionSchema>;

export const expenseTransactionSchema = z.object({
  fromAccountId: accountIdSchema,
  categoryId: categoryIdSchema,
  amount: positiveMoneyInputSchema,
  occurredOn: transactionDateSchema,
  description: transactionDescriptionSchema,
  payeeId: optionalPayeeIdSchema,
  notes: transactionNotesSchema,
  idempotencyKey: idempotencyKeySchema,
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
    idempotencyKey: idempotencyKeySchema,
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
  categoryId: categoryIdSchema,
  amount: positiveMoneyInputSchema,
  occurredOn: transactionDateSchema,
  description: transactionDescriptionSchema,
  payeeId: optionalPayeeIdSchema,
  notes: transactionNotesSchema,
  idempotencyKey: idempotencyKeySchema,
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
    idempotencyKey: idempotencyKeySchema,
  })
  .refine((data) => data.fromAccountId !== data.creditCardAccountId, {
    error: "Choose two different accounts.",
    path: ["fromAccountId"],
  });
export type CreditCardPaymentInput = z.infer<typeof creditCardPaymentSchema>;

/**
 * Editing keeps the original transaction's type and accounts fixed (which
 * accounts were involved isn't something an "edit" changes — swapping
 * accounts is really a different transaction, better handled as void +
 * new) and only revises amount/date/description/category/payee/notes.
 * category/payee stay optional here even for income/expense/
 * credit_card_purchase transactions, since edit_manual_transaction is
 * shared across every transaction type and only some of them carry a
 * category at all — the page rendering the edit form already knows the
 * original type and only shows the category field when relevant.
 */
export const editTransactionSchema = z.object({
  amount: positiveMoneyInputSchema,
  occurredOn: transactionDateSchema,
  description: transactionDescriptionSchema,
  categoryId: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), categoryIdSchema])),
  payeeId: optionalPayeeIdSchema,
  notes: transactionNotesSchema,
});
export type EditTransactionInput = z.infer<typeof editTransactionSchema>;
