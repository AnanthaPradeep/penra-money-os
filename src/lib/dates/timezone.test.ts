import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatIstDateTime,
  istCalendarDateToUtcIso,
  nowAsIstCalendarDate,
  utcIsoToIstCalendarDate,
} from "@/lib/dates/timezone";

describe("istCalendarDateToUtcIso", () => {
  it("converts an IST calendar date to its UTC midnight-minus-offset instant", () => {
    // IST is UTC+5:30, so 2026-08-16T00:00:00+05:30 is 2026-08-15T18:30:00Z.
    expect(istCalendarDateToUtcIso("2026-08-16")).toBe(
      "2026-08-15T18:30:00.000Z",
    );
  });

  it("throws on a malformed calendar date", () => {
    expect(() => istCalendarDateToUtcIso("16-08-2026")).toThrow();
  });

  it("throws on an invalid calendar date", () => {
    expect(() => istCalendarDateToUtcIso("2026-02-30")).toThrow();
  });
});

describe("utcIsoToIstCalendarDate", () => {
  it("falls on the previous IST day just before the midnight boundary", () => {
    expect(utcIsoToIstCalendarDate("2026-08-15T18:29:59.999Z")).toBe(
      "2026-08-15",
    );
  });

  it("rolls over to the next IST day exactly at the midnight boundary", () => {
    expect(utcIsoToIstCalendarDate("2026-08-15T18:30:00.000Z")).toBe(
      "2026-08-16",
    );
  });

  it("round-trips through istCalendarDateToUtcIso", () => {
    const utcIso = istCalendarDateToUtcIso("2026-01-01");
    expect(utcIsoToIstCalendarDate(utcIso)).toBe("2026-01-01");
  });
});

describe("nowAsIstCalendarDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reflects the IST calendar date even when UTC is still on the previous day", () => {
    // 2026-08-15T20:00:00Z is 2026-08-16T01:30:00+05:30 — already the 16th in IST.
    vi.setSystemTime(new Date("2026-08-15T20:00:00.000Z"));
    expect(nowAsIstCalendarDate()).toBe("2026-08-16");
  });

  it("reflects the IST calendar date even when UTC is already on the next day", () => {
    // 2026-08-16T19:00:00Z is 2026-08-17T00:30:00+05:30 — already the 17th in IST.
    vi.setSystemTime(new Date("2026-08-16T19:00:00.000Z"));
    expect(nowAsIstCalendarDate()).toBe("2026-08-17");
  });
});

describe("formatIstDateTime", () => {
  it("formats a UTC timestamp using the Asia/Kolkata offset, rolling onto the next calendar day", () => {
    const formatted = formatIstDateTime("2026-08-15T18:30:00.000Z");
    // 18:30 UTC = 00:00 IST the next calendar day (16 Aug, not 15 Aug).
    expect(formatted).toContain("16");
    expect(formatted).toContain("2026");
  });
});
