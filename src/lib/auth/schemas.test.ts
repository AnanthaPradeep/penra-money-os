import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/auth/schemas";

const VALID_SIGNUP = {
  displayName: "Asha Rao",
  email: "asha@example.com",
  password: "correct horse battery staple",
  confirmPassword: "correct horse battery staple",
};

describe("signupSchema", () => {
  it("accepts a valid signup", () => {
    const result = signupSchema.safeParse(VALID_SIGNUP);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("asha@example.com");
    }
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("trims and lowercase-normalises the email", () => {
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      email: "  Asha@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("asha@example.com");
    }
  });

  it("trims the display name", () => {
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      displayName: "  Asha Rao  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("Asha Rao");
    }
  });

  it("rejects a display name that is blank after trimming", () => {
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      displayName: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a display name at the 80-character boundary", () => {
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      displayName: "a".repeat(80),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a display name one character past the 80-character boundary", () => {
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      displayName: "a".repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password one character below the 12-character minimum", () => {
    const shortPassword = "a".repeat(11);
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      password: shortPassword,
      confirmPassword: shortPassword,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a password exactly at the 12-character minimum", () => {
    const minPassword = "a".repeat(12);
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      password: minPassword,
      confirmPassword: minPassword,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a password exactly at the 128-character maximum", () => {
    const maxPassword = "a".repeat(128);
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      password: maxPassword,
      confirmPassword: maxPassword,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password one character past the 128-character maximum", () => {
    const tooLong = "a".repeat(129);
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      password: tooLong,
      confirmPassword: tooLong,
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched password and confirmPassword", () => {
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      confirmPassword: "a completely different password",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("confirmPassword"),
        ),
      ).toBe(true);
    }
  });

  it("does not trim leading/trailing whitespace from the password", () => {
    const padded = "  correct horse battery  ";
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      password: padded,
      confirmPassword: padded,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe(padded);
      expect(result.data.password.length).toBe(padded.length);
    }
  });

  it("does not enforce any special-character requirement", () => {
    const lettersOnly = "onlylowercaseletters";
    const result = signupSchema.safeParse({
      ...VALID_SIGNUP,
      password: lettersOnly,
      confirmPassword: lettersOnly,
    });
    expect(result.success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("accepts a valid login", () => {
    const result = loginSchema.safeParse({
      email: "asha@example.com",
      password: "anything-non-empty",
    });
    expect(result.success).toBe(true);
  });

  it("normalises the email", () => {
    const result = loginSchema.safeParse({
      email: "  Asha@Example.COM ",
      password: "anything",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("asha@example.com");
    }
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "asha@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("does not alter the password text", () => {
    const password = "  Spaced Out Password  ";
    const result = loginSchema.safeParse({
      email: "asha@example.com",
      password,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe(password);
    }
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts and normalises a valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "  Asha@Example.COM ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("asha@example.com");
    }
  });

  it("rejects an invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("resendVerificationSchema", () => {
  it("accepts and normalises a valid email", () => {
    const result = resendVerificationSchema.safeParse({
      email: "Someone@Example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("someone@example.com");
    }
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a valid reset with matching passwords", () => {
    const password = "a brand new password";
    const result = resetPasswordSchema.safeParse({
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password below the 12-character minimum", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password above the 128-character maximum", () => {
    const tooLong = "a".repeat(129);
    const result = resetPasswordSchema.safeParse({
      password: tooLong,
      confirmPassword: tooLong,
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: "a brand new password",
      confirmPassword: "a different new password",
    });
    expect(result.success).toBe(false);
  });
});
