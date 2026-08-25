import { describe, expect, it } from "vitest";

import {
  classifyErrorEnvelope,
  classifyHttpStatus,
  extractDividendRows,
  extractSplitRows,
  isAbortError,
  isRecord,
  pickNumber,
  pickString,
} from "./response-mapping";

describe("isRecord", () => {
  it("accepts a plain object", () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("rejects an array, null, and a primitive", () => {
    expect(isRecord([1, 2, 3])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("hello")).toBe(false);
  });
});

describe("classifyHttpStatus", () => {
  it("treats 401/403 as a permanent auth failure", () => {
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

  it("treats 5xx as a retryable upstream error", () => {
    expect(classifyHttpStatus(500)).toEqual({
      kind: "retryable",
      code: "upstream_error",
    });
  });

  it("treats other non-2xx as a permanent, status-coded failure", () => {
    expect(classifyHttpStatus(404)).toEqual({
      kind: "permanent",
      code: "upstream_http_404",
    });
  });

  it("treats 2xx as ok", () => {
    expect(classifyHttpStatus(200)).toEqual({ kind: "ok" });
  });
});

describe("classifyErrorEnvelope", () => {
  it("returns null for a non-error envelope", () => {
    expect(classifyErrorEnvelope({ status: "ok" })).toBeNull();
  });

  it("classifies a plan-restricted message", () => {
    expect(
      classifyErrorEnvelope({
        status: "error",
        message: "This endpoint is not available on your plan.",
      }),
    ).toBe("plan_restricted");
  });

  it("classifies an invalid-symbol message", () => {
    expect(
      classifyErrorEnvelope({ status: "error", message: "Symbol not found" }),
    ).toBe("invalid_symbol");
  });

  it("falls back to a generic provider_error", () => {
    expect(
      classifyErrorEnvelope({ status: "error", message: "Something broke" }),
    ).toBe("provider_error");
  });
});

describe("isAbortError", () => {
  it("recognizes an AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("rejects any other error", () => {
    expect(isAbortError(new Error("network down"))).toBe(false);
    expect(isAbortError("not an error")).toBe(false);
  });
});

describe("pickNumber / pickString", () => {
  it("picks the first matching numeric path, including a numeric string", () => {
    expect(pickNumber({ a: { b: "1.5" } }, [["a", "b"]])).toBe(1.5);
    expect(pickNumber({ a: 2 }, [["missing"], ["a"]])).toBe(2);
  });

  it("returns null when no candidate path resolves to a finite number", () => {
    expect(pickNumber({ a: "not a number" }, [["a"]])).toBeNull();
    expect(pickNumber({}, [["missing"]])).toBeNull();
  });

  it("picks the first matching non-empty string path", () => {
    expect(pickString({ a: "  hi  " }, [["a"]])).toBe("hi");
  });

  it("returns null when no candidate path resolves to a string", () => {
    expect(pickString({}, [["missing"]])).toBeNull();
  });
});

describe("extractDividendRows", () => {
  it("extracts a well-formed dividend list", () => {
    const body = {
      dividends: [{ ex_date: "2026-03-15", amount: 12.5 }],
    };
    expect(extractDividendRows(body, "TCS")).toEqual([
      {
        exDate: "2026-03-15",
        amountPerShare: 12.5,
        providerEventId: "dividend-TCS-2026-03-15",
      },
    ]);
  });

  it("falls back to the alternate date/amount field names", () => {
    const body = { dividends: [{ date: "2026-03-15", dividend: 5 }] };
    expect(extractDividendRows(body, "TCS")).toEqual([
      {
        exDate: "2026-03-15",
        amountPerShare: 5,
        providerEventId: "dividend-TCS-2026-03-15",
      },
    ]);
  });

  it("skips an entry with a malformed date, never zero-filling", () => {
    const body = { dividends: [{ ex_date: "not-a-date", amount: 5 }] };
    expect(extractDividendRows(body, "TCS")).toEqual([]);
  });

  it("skips an entry missing an amount", () => {
    const body = { dividends: [{ ex_date: "2026-03-15" }] };
    expect(extractDividendRows(body, "TCS")).toEqual([]);
  });

  it("returns an empty array when the response has no dividends array", () => {
    expect(extractDividendRows({ meta: {} }, "TCS")).toEqual([]);
    expect(extractDividendRows(null, "TCS")).toEqual([]);
  });

  it("produces a stable, deterministic provider_event_id for idempotent re-ingestion", () => {
    const body = { dividends: [{ ex_date: "2026-03-15", amount: 12.5 }] };
    const first = extractDividendRows(body, "TCS");
    const second = extractDividendRows(body, "TCS");
    expect(first[0]?.providerEventId).toBe(second[0]?.providerEventId);
  });
});

describe("extractSplitRows", () => {
  it("extracts a well-formed split list", () => {
    const body = {
      splits: [{ date: "2026-05-01", from_factor: 1, to_factor: 2 }],
    };
    expect(extractSplitRows(body, "INFY")).toEqual([
      {
        effectiveDate: "2026-05-01",
        fromFactor: 1,
        toFactor: 2,
        providerEventId: "split-INFY-2026-05-01",
      },
    ]);
  });

  it("falls back to the alternate date field name", () => {
    const body = {
      splits: [{ split_date: "2026-05-01", from_factor: 1, to_factor: 5 }],
    };
    expect(extractSplitRows(body, "INFY")[0]?.effectiveDate).toBe("2026-05-01");
  });

  it("skips an entry missing either factor", () => {
    const body = { splits: [{ date: "2026-05-01", from_factor: 1 }] };
    expect(extractSplitRows(body, "INFY")).toEqual([]);
  });

  it("returns an empty array when the response has no splits array", () => {
    expect(extractSplitRows({ meta: {} }, "INFY")).toEqual([]);
  });
});
