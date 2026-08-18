import { z } from "zod";

import { INSTITUTION_TYPES } from "@/lib/institutions/types";

export const institutionNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter an institution name.")
  .max(120, "Institution name must be 120 characters or fewer.");

export const institutionTypeSchema = z.enum(INSTITUTION_TYPES, {
  error: "Please choose an institution type.",
});

/**
 * `z.url()` alone accepts any scheme, including "javascript:" — the
 * `protocol` restriction is required to reject anything but http(s), a
 * lesson learned validating profile URLs in Phase 2.
 */
export const institutionWebsiteSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z
        .url({
          protocol: /^https?$/,
          error: "Enter a valid http(s) website URL.",
        })
        .max(300, "Website must be 300 characters or fewer."),
    ]),
  );

export const institutionNotesSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(
    z.union([
      z.undefined(),
      z.string().max(2000, "Notes must be 2000 characters or fewer."),
    ]),
  );

export const institutionFormSchema = z.object({
  name: institutionNameSchema,
  institutionType: institutionTypeSchema,
  website: institutionWebsiteSchema,
  notes: institutionNotesSchema,
});

export type InstitutionFormInput = z.infer<typeof institutionFormSchema>;
