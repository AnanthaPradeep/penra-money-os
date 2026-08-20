import { describe, expect, it } from "vitest";

import {
  computeOccurrenceDate,
  nextOccurrenceDates,
} from "@/lib/recurring/schedule";

describe("computeOccurrenceDate", () => {
  describe("weekly", () => {
    it("steps by whole weeks from the anchor", () => {
      expect(computeOccurrenceDate("2026-08-20", "weekly", 1, 0)).toBe(
        "2026-08-20",
      );
      expect(computeOccurrenceDate("2026-08-20", "weekly", 1, 1)).toBe(
        "2026-08-27",
      );
      expect(computeOccurrenceDate("2026-08-20", "weekly", 1, 3)).toBe(
        "2026-09-10",
      );
    });

    it("supports a custom interval count (every N weeks)", () => {
      expect(computeOccurrenceDate("2026-08-20", "weekly", 2, 3)).toBe(
        "2026-10-01",
      );
    });
  });

  describe("monthly", () => {
    it("steps by whole months, preserving the anchor day when possible", () => {
      expect(computeOccurrenceDate("2026-08-15", "monthly", 1, 1)).toBe(
        "2026-09-15",
      );
    });

    it("clamps the 31st to the last day of a 30-day month", () => {
      expect(computeOccurrenceDate("2026-01-31", "monthly", 1, 3)).toBe(
        "2026-04-30",
      );
    });

    it("clamps the 31st to Feb 28 in a non-leap year", () => {
      expect(computeOccurrenceDate("2026-01-31", "monthly", 1, 1)).toBe(
        "2026-02-28",
      );
    });

    it("clamps the 31st to Feb 29 in a leap year", () => {
      expect(computeOccurrenceDate("2024-01-31", "monthly", 1, 1)).toBe(
        "2024-02-29",
      );
    });

    it("clamps the 30th to Feb 28 (never rolls into March)", () => {
      expect(computeOccurrenceDate("2026-01-30", "monthly", 1, 1)).toBe(
        "2026-02-28",
      );
    });

    it("re-clamps fresh from the anchor on every step (no compounding drift)", () => {
      // Jan 31 + 2 months should land on Mar 31 (Mar has 31 days), not be
      // dragged down to Feb 28 + 1 month = Mar 28.
      expect(computeOccurrenceDate("2026-01-31", "monthly", 1, 2)).toBe(
        "2026-03-31",
      );
    });

    it("supports a custom interval count (every N months)", () => {
      expect(computeOccurrenceDate("2026-01-15", "monthly", 3, 1)).toBe(
        "2026-04-15",
      );
    });
  });

  describe("quarterly", () => {
    it("steps by 3 months, retaining the anchored day", () => {
      expect(computeOccurrenceDate("2026-05-10", "quarterly", 1, 1)).toBe(
        "2026-08-10",
      );
    });

    it("clamps the 31st across a quarter boundary into a 30-day month", () => {
      expect(computeOccurrenceDate("2026-08-31", "quarterly", 1, 1)).toBe(
        "2026-11-30",
      );
    });
  });

  describe("half_yearly", () => {
    it("steps by 6 months, retaining the anchored day", () => {
      expect(computeOccurrenceDate("2026-02-10", "half_yearly", 1, 1)).toBe(
        "2026-08-10",
      );
    });

    it("clamps the 31st across a half-year boundary into February", () => {
      expect(computeOccurrenceDate("2026-08-31", "half_yearly", 1, 1)).toBe(
        "2027-02-28",
      );
    });
  });

  describe("yearly", () => {
    it("steps by 12 months, retaining the anchored day", () => {
      expect(computeOccurrenceDate("2026-08-20", "yearly", 1, 1)).toBe(
        "2027-08-20",
      );
    });

    it("uses Feb 28 for a Feb 29 anchor in a non-leap year", () => {
      expect(computeOccurrenceDate("2024-02-29", "yearly", 1, 1)).toBe(
        "2025-02-28",
      );
    });

    it("lands back on Feb 29 itself in the next leap year", () => {
      expect(computeOccurrenceDate("2024-02-29", "yearly", 1, 4)).toBe(
        "2028-02-29",
      );
    });
  });

  it("rejects a malformed anchor date", () => {
    expect(() =>
      computeOccurrenceDate("20-08-2026", "monthly", 1, 1),
    ).toThrow();
  });
});

describe("nextOccurrenceDates", () => {
  it("returns the requested count of dates on/after the given date", () => {
    const dates = nextOccurrenceDates(
      "2026-01-15",
      "monthly",
      1,
      "2026-01-15",
      3,
    );
    expect(dates).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  it("skips dates before the given lower bound", () => {
    const dates = nextOccurrenceDates(
      "2026-01-15",
      "monthly",
      1,
      "2026-03-01",
      2,
    );
    expect(dates).toEqual(["2026-03-15", "2026-04-15"]);
  });
});
