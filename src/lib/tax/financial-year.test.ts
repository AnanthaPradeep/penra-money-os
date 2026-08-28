import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  currentFinancialYear,
  financialYearForDate,
  financialYearFromStartYear,
  isDateInFinancialYear,
  isValidFinancialYearId,
  listRecentFinancialYearIds,
  parseFinancialYearId,
} from "@/lib/tax/financial-year";

describe("financialYearFromStartYear", () => {
  it("builds the canonical id, label, dates, and assessment year", () => {
    const fy = financialYearFromStartYear(2026);
    expect(fy.id).toBe("2026-27");
    expect(fy.label).toBe("FY 2026-27");
    expect(fy.startDate).toBe("2026-04-01");
    expect(fy.endDate).toBe("2027-03-31");
    expect(fy.assessmentYearId).toBe("2027-28");
    expect(fy.assessmentYearLabel).toBe("AY 2027-28");
  });

  it("rolls the id suffix correctly across a century boundary", () => {
    const fy = financialYearFromStartYear(2099);
    expect(fy.id).toBe("2099-00");
    expect(fy.endDate).toBe("2100-03-31");
  });

  it("rejects an out-of-range start year", () => {
    expect(() => financialYearFromStartYear(1800)).toThrow();
  });
});

describe("parseFinancialYearId / isValidFinancialYearId", () => {
  it("parses a well-formed id back to the same descriptor as constructing from a start year", () => {
    expect(parseFinancialYearId("2026-27")).toEqual(
      financialYearFromStartYear(2026),
    );
  });

  it("rejects a malformed id", () => {
    expect(() => parseFinancialYearId("2026-2027")).toThrow();
    expect(() => parseFinancialYearId("202-27")).toThrow();
    expect(() => parseFinancialYearId("not-a-fy")).toThrow();
  });

  it("rejects non-consecutive years even if the shape matches", () => {
    expect(() => parseFinancialYearId("2026-99")).toThrow();
  });

  it("isValidFinancialYearId never throws, only returns a boolean", () => {
    expect(isValidFinancialYearId("2026-27")).toBe(true);
    expect(isValidFinancialYearId("garbage")).toBe(false);
  });
});

describe("financialYearForDate — boundary cases", () => {
  it("places 1 April in the financial year starting that same calendar year", () => {
    expect(financialYearForDate("2026-04-01").id).toBe("2026-27");
  });

  it("places 31 March in the financial year that started the previous calendar year", () => {
    expect(financialYearForDate("2027-03-31").id).toBe("2026-27");
  });

  it("places 31 March 23:59-equivalent date and 1 April in adjacent, non-overlapping financial years", () => {
    const marchEnd = financialYearForDate("2027-03-31");
    const aprilStart = financialYearForDate("2027-04-01");
    expect(marchEnd.id).toBe("2026-27");
    expect(aprilStart.id).toBe("2027-28");
  });

  it("places 1 January in the financial year that started the previous April", () => {
    expect(financialYearForDate("2027-01-01").id).toBe("2026-27");
  });

  it("places 31 December in the financial year that started the same April", () => {
    expect(financialYearForDate("2026-12-31").id).toBe("2026-27");
  });

  it("rejects a malformed date string", () => {
    expect(() => financialYearForDate("2026/04/01")).toThrow();
    expect(() => financialYearForDate("04-01-2026")).toThrow();
  });
});

describe("isDateInFinancialYear", () => {
  const fy2026 = financialYearFromStartYear(2026);

  it("includes both the start and end date (inclusive range)", () => {
    expect(isDateInFinancialYear("2026-04-01", fy2026)).toBe(true);
    expect(isDateInFinancialYear("2027-03-31", fy2026)).toBe(true);
  });

  it("excludes the day just before the start and just after the end", () => {
    expect(isDateInFinancialYear("2026-03-31", fy2026)).toBe(false);
    expect(isDateInFinancialYear("2027-04-01", fy2026)).toBe(false);
  });
});

describe("currentFinancialYear — IST-aware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves to the previous financial year just before midnight IST on 1 April", () => {
    // 31 March 2027 23:59 IST == 2027-03-31T18:29:00Z.
    vi.setSystemTime(new Date("2027-03-31T18:29:00.000Z"));
    expect(currentFinancialYear().id).toBe("2026-27");
  });

  it("resolves to the new financial year exactly at midnight IST on 1 April", () => {
    // 1 April 2027 00:00 IST == 2027-03-31T18:30:00Z.
    vi.setSystemTime(new Date("2027-03-31T18:30:00.000Z"));
    expect(currentFinancialYear().id).toBe("2027-28");
  });

  it("does not roll over based on the server's own local midnight, only IST midnight", () => {
    // 2027-04-01T00:15:00Z is still 2027-04-01 05:45 IST — safely after
    // the IST rollover, so this is really just confirming the function
    // reads real UTC time via the shared IST formatter rather than any
    // server-local Date field.
    vi.setSystemTime(new Date("2027-04-01T00:15:00.000Z"));
    expect(currentFinancialYear().id).toBe("2027-28");
  });
});

describe("listRecentFinancialYearIds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T06:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the requested count, newest first, ending at the current financial year", () => {
    const ids = listRecentFinancialYearIds(3);
    expect(ids).toEqual(["2026-27", "2025-26", "2024-25"]);
  });
});
