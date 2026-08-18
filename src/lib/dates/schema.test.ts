import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { transactionDateSchema } from "@/lib/dates/schema";

describe("transactionDateSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts today's IST date", () => {
    const result = transactionDateSchema.safeParse("2026-08-16");
    expect(result.success).toBe(true);
  });

  it("accepts a past date", () => {
    const result = transactionDateSchema.safeParse("2020-01-01");
    expect(result.success).toBe(true);
  });

  it("rejects a future date", () => {
    const result = transactionDateSchema.safeParse("2026-08-17");
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date string", () => {
    const result = transactionDateSchema.safeParse("16/08/2026");
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = transactionDateSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("accepts a date that is 'tomorrow' in UTC but still 'today' in IST", () => {
    // System time is 2026-08-16T10:00:00Z — already 2026-08-16 in both UTC
    // and IST here, so use a time where UTC and IST calendar dates diverge.
    vi.setSystemTime(new Date("2026-08-16T20:00:00.000Z")); // 2026-08-17 01:30 IST
    const result = transactionDateSchema.safeParse("2026-08-17");
    expect(result.success).toBe(true);
  });
});
