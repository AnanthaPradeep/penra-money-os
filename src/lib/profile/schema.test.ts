import { describe, expect, it } from "vitest";

import { PROFILE_DEFAULTS, profileSchema } from "@/lib/profile/schema";

const VALID_PROFILE = {
  displayName: "Asha Rao",
  baseCurrency: "INR",
  locale: "en-IN",
  timezone: "Asia/Kolkata",
  financialYearStartMonth: 4,
};

describe("PROFILE_DEFAULTS", () => {
  it("matches the personal India-focused defaults", () => {
    expect(PROFILE_DEFAULTS).toEqual({
      baseCurrency: "INR",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      financialYearStartMonth: 4,
    });
  });
});

describe("profileSchema", () => {
  it("accepts a valid profile", () => {
    const result = profileSchema.safeParse(VALID_PROFILE);
    expect(result.success).toBe(true);
  });

  it("applies defaults when optional-with-default fields are omitted", () => {
    const result = profileSchema.safeParse({ displayName: "Asha Rao" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.baseCurrency).toBe(PROFILE_DEFAULTS.baseCurrency);
      expect(result.data.locale).toBe(PROFILE_DEFAULTS.locale);
      expect(result.data.timezone).toBe(PROFILE_DEFAULTS.timezone);
      expect(result.data.financialYearStartMonth).toBe(
        PROFILE_DEFAULTS.financialYearStartMonth,
      );
    }
  });

  it("trims the display name", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      displayName: "  Asha Rao  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("Asha Rao");
    }
  });

  it("rejects a blank display name", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      displayName: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a display name at the 80-character boundary", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      displayName: "a".repeat(80),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a display name one character past the 80-character boundary", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      displayName: "a".repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a base currency other than INR", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      baseCurrency: "USD",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank locale", () => {
    const result = profileSchema.safeParse({ ...VALID_PROFILE, locale: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank timezone", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      timezone: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts financial-year start month at the lower boundary (1)", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      financialYearStartMonth: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts financial-year start month at the upper boundary (12)", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      financialYearStartMonth: 12,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid financial-year start month below the range (0)", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      financialYearStartMonth: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid financial-year start month above the range (13)", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      financialYearStartMonth: 13,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer financial-year start month", () => {
    const result = profileSchema.safeParse({
      ...VALID_PROFILE,
      financialYearStartMonth: 4.5,
    });
    expect(result.success).toBe(false);
  });
});
