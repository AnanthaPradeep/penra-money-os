import { describe, expect, it } from "vitest";

import {
  classifyHttpStatus,
  classifyPriceBody,
  isAbortError,
  isRecord,
} from "./response-mapping";

describe("isRecord", () => {
  it("accepts a plain object and rejects arrays/null/primitives", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});

describe("classifyHttpStatus", () => {
  it("treats 401/403 as permanent auth failure", () => {
    expect(classifyHttpStatus(401).kind).toBe("permanent");
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

  it("treats 5xx as retryable upstream error", () => {
    expect(classifyHttpStatus(502)).toEqual({
      kind: "retryable",
      code: "upstream_error",
    });
  });

  it("treats other non-2xx as a permanent, status-coded failure", () => {
    expect(classifyHttpStatus(400)).toEqual({
      kind: "permanent",
      code: "upstream_http_400",
    });
  });

  it("treats 2xx as ok", () => {
    expect(classifyHttpStatus(200)).toEqual({ kind: "ok" });
  });
});

describe("isAbortError", () => {
  it("identifies an AbortError by name", () => {
    const err = new Error("timed out");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("rejects a plain error or non-error value", () => {
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError("boom")).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});

describe("classifyPriceBody", () => {
  it("accepts a well-formed positive price string", () => {
    expect(classifyPriceBody({ price: "1234.56" })).toEqual({
      kind: "ok",
      price: "1234.56",
    });
  });

  it("accepts an integer-valued price string", () => {
    expect(classifyPriceBody({ price: "100" })).toEqual({
      kind: "ok",
      price: "100",
    });
  });

  it("flags an error-status envelope as an invalid symbol, not a shape error", () => {
    expect(
      classifyPriceBody({ status: "error", message: "symbol not found" }),
    ).toEqual({ kind: "invalid_symbol" });
  });

  it("flags a body missing the price field as an invalid shape", () => {
    expect(classifyPriceBody({ symbol: "TCS" })).toEqual({
      kind: "invalid_response_shape",
    });
  });

  it("flags a non-object body as an invalid shape", () => {
    expect(classifyPriceBody("not an object")).toEqual({
      kind: "invalid_response_shape",
    });
    expect(classifyPriceBody(null)).toEqual({
      kind: "invalid_response_shape",
    });
  });

  it("flags a non-numeric price string as an invalid value, never coerced to 0", () => {
    expect(classifyPriceBody({ price: "not-a-number" })).toEqual({
      kind: "invalid_price_value",
    });
  });

  it("flags a zero or negative price as an invalid value", () => {
    expect(classifyPriceBody({ price: "0" })).toEqual({
      kind: "invalid_price_value",
    });
    expect(classifyPriceBody({ price: "-5" })).toEqual({
      kind: "invalid_price_value",
    });
  });

  it("flags a numeric-typed (not string-typed) price field as an invalid shape", () => {
    expect(classifyPriceBody({ price: 123.45 })).toEqual({
      kind: "invalid_response_shape",
    });
  });
});
