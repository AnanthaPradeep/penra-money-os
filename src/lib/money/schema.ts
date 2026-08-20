import { z } from "zod";

import {
  parseNonNegativeMoneyInput,
  parsePositiveMoneyInput,
} from "@/lib/money/parse";

/**
 * Zod schema for a positive money amount submitted as a form string (a
 * transaction amount, an opening balance, a credit limit). Delegates the
 * actual parsing rules to parsePositiveMoneyInput so there is exactly one
 * definition of "valid money input" in the codebase.
 */
export const positiveMoneyInputSchema = z.string().transform((raw, ctx) => {
  const result = parsePositiveMoneyInput(raw);
  if (!result.success) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.value;
});

/**
 * Same rules as positiveMoneyInputSchema, but an empty/blank string (an
 * optional form field left untouched, e.g. "opening balance") parses to
 * `undefined` instead of an error.
 */
export const optionalPositiveMoneyInputSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), positiveMoneyInputSchema]));

/** Zod schema for a budget allocation's planned amount — same rules as positiveMoneyInputSchema, but zero is valid (see parseNonNegativeMoneyInput). */
export const nonNegativeMoneyInputSchema = z.string().transform((raw, ctx) => {
  const result = parseNonNegativeMoneyInput(raw);
  if (!result.success) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.value;
});
