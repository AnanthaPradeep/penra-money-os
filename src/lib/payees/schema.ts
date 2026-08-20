import { z } from "zod";

export const payeeNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a payee name.")
  .max(100, "Payee name must be 100 characters or fewer.");

export const payeeFormSchema = z.object({
  name: payeeNameSchema,
});
export type PayeeFormInput = z.infer<typeof payeeFormSchema>;
