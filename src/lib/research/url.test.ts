import { describe, expect, it } from "vitest";

import { validateSourceUrl } from "@/lib/research/url";

describe("validateSourceUrl", () => {
  it("accepts a well-formed https URL", () => {
    const result = validateSourceUrl(
      "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
    );
    expect(result.success).toBe(true);
  });

  it("rejects a blank value", () => {
    const result = validateSourceUrl("   ");
    expect(result).toEqual({ success: false, error: "Enter a URL." });
  });

  it("rejects an http (non-https) URL", () => {
    const result = validateSourceUrl("http://example.com/report.pdf");
    expect(result.success).toBe(false);
  });

  it("rejects a javascript: URL", () => {
    const result = validateSourceUrl("javascript:alert(1)");
    expect(result.success).toBe(false);
  });

  it("rejects a data: URL", () => {
    const result = validateSourceUrl(
      "data:text/html,<script>alert(1)</script>",
    );
    expect(result.success).toBe(false);
  });

  it("rejects a file: URL", () => {
    const result = validateSourceUrl("file:///etc/passwd");
    expect(result.success).toBe(false);
  });

  it("rejects a URL with embedded credentials", () => {
    const result = validateSourceUrl(
      "https://user:pass@example.com/report.pdf",
    );
    expect(result.success).toBe(false);
  });

  it("rejects localhost", () => {
    const result = validateSourceUrl("https://localhost/internal");
    expect(result.success).toBe(false);
  });

  it("rejects a loopback IPv4 address", () => {
    const result = validateSourceUrl("https://127.0.0.1/internal");
    expect(result.success).toBe(false);
  });

  it("rejects a private 10.x IPv4 address", () => {
    const result = validateSourceUrl("https://10.0.0.5/internal");
    expect(result.success).toBe(false);
  });

  it("rejects a private 192.168.x IPv4 address", () => {
    const result = validateSourceUrl("https://192.168.1.1/internal");
    expect(result.success).toBe(false);
  });

  it("rejects a private 172.16-31.x IPv4 address", () => {
    const result = validateSourceUrl("https://172.20.0.1/internal");
    expect(result.success).toBe(false);
  });

  it("does not falsely reject a public IP resembling 172.x outside the private range", () => {
    const result = validateSourceUrl("https://172.64.0.1/report");
    expect(result.success).toBe(true);
  });

  it("rejects an IPv6 loopback address", () => {
    const result = validateSourceUrl("https://[::1]/internal");
    expect(result.success).toBe(false);
  });

  it("rejects an overly long URL", () => {
    const result = validateSourceUrl(`https://example.com/${"a".repeat(2100)}`);
    expect(result.success).toBe(false);
  });

  it("rejects a malformed URL string", () => {
    const result = validateSourceUrl("not a url at all");
    expect(result.success).toBe(false);
  });
});
