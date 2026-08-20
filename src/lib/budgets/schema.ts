import { z } from "zod";

import { calendarDateSchema } from "@/lib/dates/schema";
import { nonNegativeMoneyInputSchema } from "@/lib/money/schema";

/** One category's planned amount within a save_budget_allocations call. */
export const budgetAllocationEntrySchema = z.object({
  categoryId: z.uuid("Choose a valid category."),
  plannedAmount: nonNegativeMoneyInputSchema,
});
export type BudgetAllocationEntryInput = z.infer<
  typeof budgetAllocationEntrySchema
>;

export const saveBudgetAllocationsSchema = z.object({
  budgetPeriodId: z.uuid(),
  plannedIncome: nonNegativeMoneyInputSchema.optional(),
  allocations: z.array(budgetAllocationEntrySchema),
});
export type SaveBudgetAllocationsInput = z.infer<
  typeof saveBudgetAllocationsSchema
>;

export const copyBudgetPeriodSchema = z.object({
  sourcePeriodMonth: calendarDateSchema,
  targetPeriodMonth: calendarDateSchema,
});
export type CopyBudgetPeriodInput = z.infer<typeof copyBudgetPeriodSchema>;
