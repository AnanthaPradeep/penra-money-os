import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import { serializeForSnapshot } from "@/lib/tax/snapshot";

describe("serializeForSnapshot", () => {
  it("converts a Decimal to its exact string, never a JS number", () => {
    expect(serializeForSnapshot(new Decimal("1234.5678"))).toBe("1234.5678");
  });

  it("preserves exact precision that a float would lose", () => {
    const value = new Decimal("0.1").plus(new Decimal("0.2"));
    expect(serializeForSnapshot(value)).toBe("0.3");
  });

  it("recursively converts Decimals nested inside plain objects and arrays", () => {
    const result = serializeForSnapshot({
      total: new Decimal("500"),
      lines: [{ amount: new Decimal("100") }, { amount: new Decimal("400") }],
    });
    expect(result).toEqual({
      total: "500",
      lines: [{ amount: "100" }, { amount: "400" }],
    });
  });

  it("converts a Map into a plain keyed object", () => {
    const map = new Map<string, Decimal>([
      ["a", new Decimal("1")],
      ["b", new Decimal("2")],
    ]);
    expect(serializeForSnapshot(map)).toEqual({ a: "1", b: "2" });
  });

  it("passes through plain strings, numbers, booleans, and null unchanged", () => {
    expect(serializeForSnapshot("complete")).toBe("complete");
    expect(serializeForSnapshot(42)).toBe(42);
    expect(serializeForSnapshot(true)).toBe(true);
    expect(serializeForSnapshot(null)).toBe(null);
    expect(serializeForSnapshot(undefined)).toBe(null);
  });

  it("converts a Date to an ISO string", () => {
    const date = new Date("2026-08-27T12:00:00.000Z");
    expect(serializeForSnapshot(date)).toBe("2026-08-27T12:00:00.000Z");
  });

  it("round-trips a realistic nested engine-result shape", () => {
    const input = {
      financialYearId: "2025-26",
      old: { totalTaxLiability: new Decimal("12345.6789"), status: "available" },
      new: { totalTaxLiability: new Decimal("9876.5432"), status: "partial" },
      warnings: ["surcharge unsupported above threshold"],
    };
    const result = serializeForSnapshot(input);
    expect(JSON.stringify(result)).toBe(
      JSON.stringify({
        financialYearId: "2025-26",
        old: { totalTaxLiability: "12345.6789", status: "available" },
        new: { totalTaxLiability: "9876.5432", status: "partial" },
        warnings: ["surcharge unsupported above threshold"],
      }),
    );
  });
});
