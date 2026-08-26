import { describe, expect, it } from "vitest";

import { parseStatementDate } from "@/lib/bank-import/dates";

const TODAY = "2026-08-25";

describe("parseStatementDate", () => {
  it("parses DD/MM/YYYY", () => {
    const result = parseStatementDate("05/03/2026", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({
      success: true,
      isoDate: "2026-03-05",
      isFuture: false,
    });
  });

  it("parses DD-MM-YYYY", () => {
    const result = parseStatementDate("05-03-2026", "DD-MM-YYYY", TODAY);
    expect(result).toEqual({
      success: true,
      isoDate: "2026-03-05",
      isFuture: false,
    });
  });

  it("parses YYYY-MM-DD", () => {
    const result = parseStatementDate("2026-03-05", "YYYY-MM-DD", TODAY);
    expect(result).toEqual({
      success: true,
      isoDate: "2026-03-05",
      isFuture: false,
    });
  });

  it("parses DD MMM YYYY", () => {
    const result = parseStatementDate("05 Mar 2026", "DD MMM YYYY", TODAY);
    expect(result).toEqual({
      success: true,
      isoDate: "2026-03-05",
      isFuture: false,
    });
  });

  it("parses DD MMM YYYY case-insensitively", () => {
    const result = parseStatementDate("05 MAR 2026", "DD MMM YYYY", TODAY);
    expect(result).toEqual({
      success: true,
      isoDate: "2026-03-05",
      isFuture: false,
    });
  });

  it("expands a two-digit year <= 79 to 20YY", () => {
    const result = parseStatementDate("05/03/26", "DD/MM/YY", TODAY);
    expect(result).toEqual({
      success: true,
      isoDate: "2026-03-05",
      isFuture: false,
    });
  });

  it("expands a two-digit year >= 80 to 19YY", () => {
    const result = parseStatementDate("05/03/95", "DD/MM/YY", TODAY);
    expect(result).toEqual({
      success: true,
      isoDate: "1995-03-05",
      isFuture: false,
    });
  });

  it("flags a date after today as future", () => {
    const result = parseStatementDate("01/01/2027", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({
      success: true,
      isoDate: "2027-01-01",
      isFuture: true,
    });
  });

  it("does not flag today itself as future", () => {
    const result = parseStatementDate("25/08/2026", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({ success: true, isoDate: TODAY, isFuture: false });
  });

  it("rejects an impossible day-of-month (Feb 30)", () => {
    const result = parseStatementDate("30/02/2026", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({ success: false, reason: "invalid_date" });
  });

  it("accepts Feb 29 on a leap year", () => {
    const result = parseStatementDate("29/02/2028", "DD/MM/YYYY", TODAY);
    expect(result.success).toBe(true);
  });

  it("rejects Feb 29 on a non-leap year", () => {
    const result = parseStatementDate("29/02/2026", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({ success: false, reason: "invalid_date" });
  });

  it("rejects month 13", () => {
    const result = parseStatementDate("05/13/2026", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({ success: false, reason: "invalid_date" });
  });

  it("rejects day 0", () => {
    const result = parseStatementDate("00/03/2026", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({ success: false, reason: "invalid_date" });
  });

  it("rejects an empty string", () => {
    const result = parseStatementDate("", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({ success: false, reason: "invalid_date" });
  });

  it("rejects a value in the wrong explicit format", () => {
    // MM/DD/YYYY-shaped input against a DD/MM/YYYY format that would be
    // ambiguous if guessed — but since the format is explicit, "13" in the
    // month position simply fails outright rather than being reinterpreted.
    const result = parseStatementDate("13/25/2026", "DD/MM/YYYY", TODAY);
    expect(result).toEqual({ success: false, reason: "invalid_date" });
  });

  it("rejects a completely unparseable string", () => {
    const result = parseStatementDate("not-a-date", "YYYY-MM-DD", TODAY);
    expect(result).toEqual({ success: false, reason: "invalid_date" });
  });

  it("rejects an unrecognized month abbreviation", () => {
    const result = parseStatementDate("05 Xyz 2026", "DD MMM YYYY", TODAY);
    expect(result).toEqual({ success: false, reason: "invalid_date" });
  });

  it("trims surrounding whitespace", () => {
    const result = parseStatementDate("  05/03/2026  ", "DD/MM/YYYY", TODAY);
    expect(result.success).toBe(true);
  });
});
