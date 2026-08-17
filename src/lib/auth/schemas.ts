import { z } from "zod";

/**
 * Shared building blocks for every auth form. Kept here once so signup,
 * login, forgot-password, and reset-password never re-derive slightly
 * different rules for the same field.
 */

/** Trimmed, lowercase-normalised, bounded-length, valid-format email. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter your name.")
  .max(80, "Name must be 80 characters or fewer.");

/**
 * New-password rule: length only, deliberately no arbitrary
 * special-character requirements. Not trimmed — leading/trailing
 * whitespace is significant and part of what the user typed.
 */
export const newPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(128, "Password must be 128 characters or fewer.");

/** Login password: presence only — the server, not this form, decides validity. */
export const currentPasswordSchema = z
  .string()
  .min(1, "Please enter your password.");

/** Shared cross-field check: `confirmPassword` must match `password`. */
function passwordsMatch(data: { password: string; confirmPassword: string }) {
  return data.password === data.confirmPassword;
}
const PASSWORDS_MATCH_ISSUE = {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
};

export const signupSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH_ISSUE);

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: currentPasswordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Also used for the verify-email screen's "resend confirmation" form. */
export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORDS_MATCH_ISSUE);

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
