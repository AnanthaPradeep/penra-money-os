import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import {
  optionalPositiveMoneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/money/schema";

describe("positiveMoneyInputSchema", () => {
  it("parses a valid amount string into a Decimal", () => {
    const result = positiveMoneyInputSchema.safeParse("500.25");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(Decimal);
      expect(result.data.toString()).toBe("500.25");
    }
  });

  it("rejects zero with the underlying parse error message", () => {
    const result = positiveMoneyInputSchema.safeParse("0");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Amount must be greater than zero.",
      );
    }
  });

  it("rejects a negative amount", () => {
    const result = positiveMoneyInputSchema.safeParse("-10");
    expect(result.success).toBe(false);
  });

  it("rejects scientific notation", () => {
    const result = positiveMoneyInputSchema.safeParse("1e3");
    expect(result.success).toBe(false);
  });

  it("rejects more than 4 decimal places", () => {
    const result = positiveMoneyInputSchema.safeParse("1.23456");
    expect(result.success).toBe(false);
  });
});

describe("optionalPositiveMoneyInputSchema", () => {
  it("parses undefined to undefined", () => {
    const result = optionalPositiveMoneyInputSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeUndefined();
    }
  });

  it("parses an empty string to undefined", () => {
    const result = optionalPositiveMoneyInputSchema.safeParse("");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeUndefined();
    }
  });

  it("parses a whitespace-only string to undefined", () => {
    const result = optionalPositiveMoneyInputSchema.safeParse("   ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeUndefined();
    }
  });

  it("parses a valid amount into a Decimal", () => {
    const result = optionalPositiveMoneyInputSchema.safeParse("2500");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(Decimal);
      expect(result.data?.toString()).toBe("2500");
    }
  });

  it("still rejects an invalid non-empty amount", () => {
    const result = optionalPositiveMoneyInputSchema.safeParse("-5");
    expect(result.success).toBe(false);
  });
});
