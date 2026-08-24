import { describe, expect, it } from "vitest";

import { looksLikeAmfiNavContent, parseAmfiNavAll } from "./parser";

const HEADER =
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date";

describe("looksLikeAmfiNavContent", () => {
  it("accepts real AMFI content starting with the expected header", () => {
    expect(looksLikeAmfiNavContent(`${HEADER}\n\n118825;...`)).toBe(true);
  });

  it("rejects an empty response", () => {
    expect(looksLikeAmfiNavContent("")).toBe(false);
  });

  it("rejects an HTML error page (e.g. a 5xx error document served with a 200 status)", () => {
    expect(
      looksLikeAmfiNavContent("<!DOCTYPE html><html><body>Error</body></html>"),
    ).toBe(false);
  });

  it("rejects unrelated content that happens to be non-empty", () => {
    expect(looksLikeAmfiNavContent("Not Found")).toBe(false);
  });
});

describe("parseAmfiNavAll", () => {
  it("parses a well-formed data row (real AMFI shape: scheme code, two ISIN columns, name, plan, option, NAV, date)", () => {
    const content = [
      HEADER,
      "",
      "Open Ended Schemes(Debt Scheme - Banking and PSU Fund)",
      "",
      "Aditya Birla Sun Life Mutual Fund",
      "",
      "119551;INF209KA12Z1;INF209KA13Z9;Aditya Birla Sun Life Banking & PSU Debt Fund;Direct Plan;IDCW-Re-investment;106.9996;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.issues).toHaveLength(0);
    expect(result.rows).toEqual([
      {
        schemeCode: "119551",
        isinGrowth: "INF209KA12Z1",
        isinReinvestment: "INF209KA13Z9",
        schemeName: "Aditya Birla Sun Life Banking & PSU Debt Fund",
        plan: "Direct Plan",
        option: "IDCW-Re-investment",
        nav: "106.9996",
        navDate: "2026-08-20",
      },
    ]);
  });

  it("skips blank lines, the header row, category rows, and AMC-name rows without reporting them as issues", () => {
    const content = [
      HEADER,
      "",
      "Open Ended Schemes(Equity Scheme - Large Cap Fund)",
      "",
      "HDFC Mutual Fund",
      "",
      "100001;INF179K01VV8;-;HDFC Large Cap Fund;Direct Plan;Growth;850.1234;20-Aug-2026",
      "",
      "Open Ended Schemes(Equity Scheme - Mid Cap Fund)",
      "",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
  });

  it("reports a row with the wrong number of fields as a malformed row, not a crash", () => {
    const content = [HEADER, "118825;INF209K01UN5;Only three fields"].join(
      "\n",
    );

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toEqual([
      {
        lineNumber: 2,
        reason: "wrong_field_count",
        raw: "118825;INF209K01UN5;Only three fields",
      },
    ]);
  });

  it("rejects a non-numeric scheme code", () => {
    const content = [
      HEADER,
      "ABCDE;INF209K01UN5;-;Some Fund;Direct Plan;Growth;100.0000;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]?.reason).toBe("invalid_scheme_code");
  });

  it("rejects a missing NAV ('N.A.') instead of fabricating a value", () => {
    const content = [
      HEADER,
      "118825;INF209K01UN5;-;Some Fund;Direct Plan;Growth;N.A.;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]?.reason).toBe("invalid_nav");
  });

  it("rejects a zero or negative NAV", () => {
    const content = [
      HEADER,
      "118825;INF209K01UN5;-;Some Fund;Direct Plan;Growth;0.0000;20-Aug-2026",
      "118826;INF209K01UN6;-;Some Other Fund;Direct Plan;Growth;-5.0000;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((i) => i.reason === "invalid_nav")).toBe(true);
  });

  it("rejects an invalid date rather than guessing", () => {
    const content = [
      HEADER,
      "118825;INF209K01UN5;-;Some Fund;Direct Plan;Growth;100.0000;32-Aug-2026",
      "118826;INF209K01UN6;-;Some Fund 2;Direct Plan;Growth;100.0000;20-Foo-2026",
      "118827;INF209K01UN7;-;Some Fund 3;Direct Plan;Growth;100.0000;2026-08-20",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(0);
    expect(result.issues.every((i) => i.reason === "invalid_date")).toBe(true);
  });

  it("rejects a row with a blank scheme name", () => {
    const content = [
      HEADER,
      "118825;INF209K01UN5;-;;Direct Plan;Growth;100.0000;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]?.reason).toBe("missing_scheme_name");
  });

  it("keeps the first occurrence and flags a later duplicate scheme code", () => {
    const content = [
      HEADER,
      "118825;INF209K01UN5;-;Fund A;Direct Plan;Growth;100.0000;20-Aug-2026",
      "118825;INF209K01UN5;-;Fund A (corrected name);Direct Plan;Growth;105.0000;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.nav).toBe("100.0000");
    expect(result.issues).toEqual([
      {
        lineNumber: 3,
        reason: "duplicate_scheme_code",
        raw: "118825;INF209K01UN5;-;Fund A (corrected name);Direct Plan;Growth;105.0000;20-Aug-2026",
      },
    ]);
  });

  it("normalizes a '-' ISIN placeholder to null rather than storing the literal dash", () => {
    const content = [
      HEADER,
      "118825;-;-;Fund A;Direct Plan;Growth;100.0000;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows[0]).toMatchObject({
      isinGrowth: null,
      isinReinvestment: null,
    });
  });

  it("preserves Plan and Option exactly as AMFI wrote them, never inferring Direct/Regular or Growth/IDCW from the scheme name", () => {
    const content = [
      HEADER,
      "108273;INF209K01LV0;-;Aditya Birla Sun Life Banking & PSU Debt Fund;Regular Plan;GROWTH;387.8554;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows[0]).toMatchObject({
      plan: "Regular Plan",
      option: "GROWTH",
    });
  });

  it("continues past malformed rows and still parses the good ones in the same file", () => {
    const content = [
      HEADER,
      "not a data row at all",
      "118825;INF209K01UN5;-;Good Fund;Direct Plan;Growth;100.0000;20-Aug-2026",
      "118826;INF209K01UN6;-;Bad NAV Fund;Direct Plan;Growth;N.A.;20-Aug-2026",
      "118827;INF209K01UN7;-;Another Good Fund;Direct Plan;Growth;200.5000;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows.map((r) => r.schemeCode)).toEqual(["118825", "118827"]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.reason).toBe("invalid_nav");
  });

  it("handles Windows-style CRLF line endings identically to LF", () => {
    const content = [
      HEADER,
      "118825;INF209K01UN5;-;Fund A;Direct Plan;Growth;100.0000;20-Aug-2026",
    ].join("\r\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.navDate).toBe("2026-08-20");
  });

  it("preserves the NAV as exact decimal text, never a parsed JS float", () => {
    const content = [
      HEADER,
      "118825;INF209K01UN5;-;Precision Fund;Direct Plan;Growth;1234.5678901234;20-Aug-2026",
    ].join("\n");

    const result = parseAmfiNavAll(content);

    expect(result.rows[0]?.nav).toBe("1234.5678901234");
    expect(typeof result.rows[0]?.nav).toBe("string");
  });
});
