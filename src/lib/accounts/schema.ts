import { z } from "zod";

import { USER_ACCOUNT_TYPES, isCreditCardType } from "@/lib/accounts/classes";
import { optionalPositiveMoneyInputSchema } from "@/lib/money/schema";

export const accountNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter an account name.")
  .max(120, "Account name must be 120 characters or fewer.");

export const accountTypeSchema = z.enum(USER_ACCOUNT_TYPES, {
  error: "Please choose an account type.",
});

const uuidOrBlank = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.uuid("Choose a valid institution.")]));

export const lastFourSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().regex(/^\d{4}$/, "Enter exactly 4 digits, or leave blank."),
    ]),
  );

export const accountNotesSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().max(2000, "Notes must be 2000 characters or fewer."),
    ]),
  );

export const accountFormSchema = z
  .object({
    name: accountNameSchema,
    accountType: accountTypeSchema,
    institutionId: uuidOrBlank,
    currency: z.literal("INR").default("INR"),
    lastFour: lastFourSchema,
    creditLimit: optionalPositiveMoneyInputSchema,
    openedOn: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      ),
    notes: accountNotesSchema,
    openingBalance: optionalPositiveMoneyInputSchema,
  })
  .superRefine((data, ctx) => {
    if (data.creditLimit !== undefined && !isCreditCardType(data.accountType)) {
      ctx.addIssue({
        code: "custom",
        path: ["creditLimit"],
        message: "Credit limit only applies to credit card accounts.",
      });
    }
  });

export type AccountFormInput = z.infer<typeof accountFormSchema>;
