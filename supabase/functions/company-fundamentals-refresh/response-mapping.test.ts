import { describe, expect, it } from "vitest";

import {
  classifyErrorEnvelope,
  classifyHttpStatus,
  deriveFiscalQuarter,
  extractMetricRows,
  FISCAL_DATE_PATTERN,
  INCOME_STATEMENT_FIELDS,
  isAbortError,
  isRecord,
  pickNumber,
  pickString,
} from "./response-mapping";

describe("isRecord", () => {
  it("accepts a plain object", () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("rejects an array", () => {
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it("rejects null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("rejects a primitive", () => {
    expect(isRecord("hello")).toBe(false);
    expect(isRecord(42)).toBe(false);
  });
});

describe("classifyHttpStatus", () => {
  it("treats 401 and 403 as a permanent auth failure", () => {
    expect(classifyHttpStatus(401)).toEqual({
      kind: "permanent",
      code: "provider_auth_failed",
    });
    expect(classifyHttpStatus(403)).toEqual({
      kind: "permanent",
      code: "provider_auth_failed",
    });
  });

  it("treats 429 as retryable rate limiting", () => {
    expect(classifyHttpStatus(429)).toEqual({
      kind: "retryable",
      code: "rate_limited",
    });
  });

  it("treats any 5xx as a retryable upstream error", () => {
    expect(classifyHttpStatus(500)).toEqual({
      kind: "retryable",
      code: "upstream_error",
    });
    expect(classifyHttpStatus(503)).toEqual({
      kind: "retryable",
      code: "upstream_error",
    });
  });

  it("treats an unmapped 4xx as a permanent, code-specific failure", () => {
    expect(classifyHttpStatus(404)).toEqual({
      kind: "permanent",
      code: "upstream_http_404",
    });
  });

  it("treats 200-299 as ok", () => {
    expect(classifyHttpStatus(200)).toEqual({ kind: "ok" });
    expect(classifyHttpStatus(204)).toEqual({ kind: "ok" });
  });
});

describe("classifyErrorEnvelope", () => {
  it("returns null for a body with no error status", () => {
    expect(classifyErrorEnvelope({ price: "123.45" })).toBeNull();
  });

  it("detects a plan-restriction message", () => {
    expect(
      classifyErrorEnvelope({
        status: "error",
        message: "This endpoint is not available under your current plan.",
      }),
    ).toBe("plan_restricted");
  });

  it("detects a plan-restriction message phrased as a subscription upsell", () => {
    expect(
      classifyErrorEnvelope({
        status: "error",
        message: "Please subscribe to a higher tier to access this data.",
      }),
    ).toBe("plan_restricted");
  });

  it("detects an invalid-symbol message", () => {
    expect(
      classifyErrorEnvelope({
        status: "error",
        message: "**symbol** not found: BOGUS",
      }),
    ).toBe("invalid_symbol");
  });

  it("falls back to a generic provider_error for an unrecognized error message", () => {
    expect(
      classifyErrorEnvelope({ status: "error", message: "Something broke" }),
    ).toBe("provider_error");
  });

  it("falls back to a generic provider_error when the message field is missing entirely", () => {
    expect(classifyErrorEnvelope({ status: "error" })).toBe("provider_error");
  });
});

describe("isAbortError", () => {
  it("recognizes an AbortController-style AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("does not treat a generic Error as an abort", () => {
    expect(isAbortError(new Error("network down"))).toBe(false);
  });

  it("does not treat a non-Error throwable as an abort", () => {
    expect(isAbortError("some string")).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe("pickNumber", () => {
  it("resolves a nested numeric field", () => {
    const body = { assets: { total_assets: 12345.6 } };
    expect(pickNumber(body, [["assets", "total_assets"]])).toBe(12345.6);
  });

  it("parses a numeric string field", () => {
    const body = { sales: "98765.4" };
    expect(pickNumber(body, [["sales"]])).toBe(98765.4);
  });

  it("tries the next candidate path when the first is absent", () => {
    const body = { revenue: 500 };
    expect(pickNumber(body, [["sales"], ["revenue"]])).toBe(500);
  });

  it("returns null (never 0) when no candidate path resolves to a number", () => {
    const body = { unrelated_field: "x" };
    expect(pickNumber(body, [["sales"], ["revenue"]])).toBeNull();
  });

  it("returns null for a non-numeric string", () => {
    expect(pickNumber({ sales: "not-a-number" }, [["sales"]])).toBeNull();
  });

  it("returns null when traversing through a non-object", () => {
    expect(pickNumber({ sales: 5 }, [["sales", "nested"]])).toBeNull();
  });

  it("returns null for NaN/Infinity-producing input rather than propagating them", () => {
    expect(pickNumber({ sales: "Infinity" }, [["sales"]])).toBeNull();
    expect(pickNumber({ sales: NaN }, [["sales"]])).toBeNull();
  });
});

describe("pickString", () => {
  it("resolves and trims a nested string field", () => {
    expect(
      pickString({ meta: { currency: " USD " } }, [["meta", "currency"]]),
    ).toBe("USD");
  });

  it("returns null for a blank string", () => {
    expect(pickString({ name: "   " }, [["name"]])).toBeNull();
  });

  it("returns null when the field is absent", () => {
    expect(pickString({}, [["name"]])).toBeNull();
  });
});

describe("deriveFiscalQuarter", () => {
  it("maps January-March to Q1", () => {
    expect(deriveFiscalQuarter("2025-01-15")).toBe(1);
    expect(deriveFiscalQuarter("2025-03-31")).toBe(1);
  });

  it("maps October-December to Q4", () => {
    expect(deriveFiscalQuarter("2025-10-01")).toBe(4);
    expect(deriveFiscalQuarter("2025-12-31")).toBe(4);
  });

  it("returns null for an unparseable month", () => {
    expect(deriveFiscalQuarter("2025-13-01")).toBeNull();
    expect(deriveFiscalQuarter("2025-00-01")).toBeNull();
  });
});

describe("FISCAL_DATE_PATTERN", () => {
  it("accepts an ISO calendar date", () => {
    expect(FISCAL_DATE_PATTERN.test("2025-03-31")).toBe(true);
  });

  it("rejects a non-ISO date string", () => {
    expect(FISCAL_DATE_PATTERN.test("31-Mar-2025")).toBe(false);
    expect(FISCAL_DATE_PATTERN.test("not-a-date")).toBe(false);
  });
});

describe("extractMetricRows", () => {
  it("extracts every income-statement field present in the period object", () => {
    const periodObject = {
      sales: 1000,
      net_income: 100,
      eps_basic: 2.5,
    };
    const rows = extractMetricRows(
      periodObject,
      "period-1",
      "income_statement",
      INCOME_STATEMENT_FIELDS,
      "twelve_data",
    );

    const byKey = new Map(rows.map((r) => [r.metric_key, r.value]));
    expect(byKey.get("revenue")).toBe(1000);
    expect(byKey.get("net_income")).toBe(100);
    expect(byKey.get("eps_basic")).toBe(2.5);
    expect(rows.every((r) => r.period_id === "period-1")).toBe(true);
    expect(rows.every((r) => r.statement_type === "income_statement")).toBe(
      true,
    );
  });

  it("skips fields entirely absent from the period object, rather than emitting a zero", () => {
    const rows = extractMetricRows(
      { sales: 1000 },
      "period-1",
      "income_statement",
      INCOME_STATEMENT_FIELDS,
      "twelve_data",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metric_key).toBe("revenue");
  });

  it("returns an empty array for a period object with no recognizable fields", () => {
    const rows = extractMetricRows(
      { unrelated: true },
      "period-1",
      "income_statement",
      INCOME_STATEMENT_FIELDS,
      "twelve_data",
    );
    expect(rows).toEqual([]);
  });
});
