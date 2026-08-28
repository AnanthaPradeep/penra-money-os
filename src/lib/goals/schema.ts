import { z } from "zod";

import { calendarDateSchema } from "@/lib/dates/schema";
import {
  EF_TARGET_METHODS,
  GOAL_CONTRIBUTION_DIRECTIONS,
  GOAL_TYPES,
  SF_CONTRIBUTION_FREQUENCIES,
} from "@/lib/goals/mapping";
import {
  nonNegativeMoneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/money/schema";

export const goalNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a goal name.")
  .max(100, "Goal name must be 100 characters or fewer.");

export const goalNotesSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().max(2000, "Notes must be 2000 characters or fewer."),
    ]),
  );

const optionalUuid = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.uuid()]));

const optionalDate = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), calendarDateSchema]));

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

export const createFinancialGoalSchema = z
  .object({
    name: goalNameSchema,
    goalType: z.enum(GOAL_TYPES, { error: "Choose a goal type." }),
    currency: z.literal("INR").default("INR"),
    targetAmount: positiveMoneyInputSchema,
    targetDate: optionalDate,
    startDate: optionalDate,
    priority: z.coerce.number().int().min(0).max(100).default(0),
    fundingMode: z.enum(["earmarked", "planning_only"]).default("earmarked"),
    purposeWalletId: optionalUuid,
    notes: goalNotesSchema,
    efTargetMethod: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), z.enum(EF_TARGET_METHODS)])),
    efTargetMonths: optionalIntegerInput(
      1,
      60,
      "Enter a number of months between 1 and 60.",
    ),
    efEssentialMonthlyExpense: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), nonNegativeMoneyInputSchema])),
    efEssentialCategoryIds: z.array(z.uuid()).optional(),
    efEssentialPeriodStart: optionalDate,
    efEssentialPeriodEnd: optionalDate,
    sfContributionFrequency: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), z.enum(SF_CONTRIBUTION_FREQUENCIES)])),
  })
  .refine(
    (data) =>
      data.targetDate === undefined ||
      data.startDate === undefined ||
      data.targetDate >= data.startDate,
    {
      error: "Target date must be on or after the start date.",
      path: ["targetDate"],
    },
  );
export type CreateFinancialGoalInput = z.infer<
  typeof createFinancialGoalSchema
>;

export const updateFinancialGoalSchema = z.object({
  name: goalNameSchema,
  targetAmount: positiveMoneyInputSchema,
  targetDate: optionalDate,
  priority: z.coerce.number().int().min(0).max(100).default(0),
  notes: goalNotesSchema,
  efTargetMethod: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.enum(EF_TARGET_METHODS)])),
  efTargetMonths: optionalIntegerInput(
    1,
    60,
    "Enter a number of months between 1 and 60.",
  ),
  efEssentialMonthlyExpense: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), nonNegativeMoneyInputSchema])),
  sfContributionFrequency: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.enum(SF_CONTRIBUTION_FREQUENCIES)])),
});
export type UpdateFinancialGoalInput = z.infer<
  typeof updateFinancialGoalSchema
>;

export const goalStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
  "archived",
]);

export const goalMilestoneSchema = z.object({
  name: z.string().trim().min(1, "Please enter a milestone name.").max(100),
  targetAmount: positiveMoneyInputSchema,
  // A plain string-equality check, not z.coerce.boolean() — coercing the
  // literal string "false" with Boolean() yields `true` (any non-empty
  // string is truthy in JS), which would make an unchecked checkbox
  // behave as checked. See src/lib/debts/schema.ts's identical fix for
  // allowOverpayment.
  achieved: z
    .string()
    .optional()
    .transform((raw) => raw === "true"),
});
export type GoalMilestoneInput = z.infer<typeof goalMilestoneSchema>;

export const idempotencyKeySchema = z.uuid();

export const goalContributionAllocationSchema = z.object({
  amount: positiveMoneyInputSchema,
  direction: z.enum(GOAL_CONTRIBUTION_DIRECTIONS, {
    error: "Choose contribution or withdrawal.",
  }),
  notes: goalNotesSchema,
  idempotencyKey: idempotencyKeySchema,
});
export type GoalContributionAllocationInput = z.infer<
  typeof goalContributionAllocationSchema
>;

export const goalContributionTransferSchema = z
  .object({
    fromAccountId: z.uuid("Choose a source account."),
    toAccountId: z.uuid("Choose a destination account."),
    amount: positiveMoneyInputSchema,
    occurredOn: calendarDateSchema,
    notes: goalNotesSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    error: "Choose two different accounts.",
    path: ["toAccountId"],
  });
export type GoalContributionTransferInput = z.infer<
  typeof goalContributionTransferSchema
>;
