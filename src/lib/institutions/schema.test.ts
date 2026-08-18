import { describe, expect, it } from "vitest";

import { institutionFormSchema } from "@/lib/institutions/schema";

const VALID_INSTITUTION = {
  name: "HDFC Bank",
  institutionType: "bank",
};

describe("institutionFormSchema", () => {
  it("accepts a minimal valid institution", () => {
    const result = institutionFormSchema.safeParse(VALID_INSTITUTION);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("rejects a blank name", () => {
    const result = institutionFormSchema.safeParse({
      ...VALID_INSTITUTION,
      name: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised institution type", () => {
    const result = institutionFormSchema.safeParse({
      ...VALID_INSTITUTION,
      institutionType: "casino",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid https website", () => {
    const result = institutionFormSchema.safeParse({
      ...VALID_INSTITUTION,
      website: "https://www.hdfcbank.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid http website", () => {
    const result = institutionFormSchema.safeParse({
      ...VALID_INSTITUTION,
      website: "http://example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a javascript: URL", () => {
    const result = institutionFormSchema.safeParse({
      ...VALID_INSTITUTION,
      website: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed website string", () => {
    const result = institutionFormSchema.safeParse({
      ...VALID_INSTITUTION,
      website: "not a url",
    });
    expect(result.success).toBe(false);
  });

  it("treats a blank website as omitted", () => {
    const result = institutionFormSchema.safeParse({
      ...VALID_INSTITUTION,
      website: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBeUndefined();
    }
  });

  it("rejects notes over 2000 characters", () => {
    const result = institutionFormSchema.safeParse({
      ...VALID_INSTITUTION,
      notes: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
