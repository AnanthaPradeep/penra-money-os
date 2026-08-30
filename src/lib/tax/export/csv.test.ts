import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/lib/tax/export/csv";

describe("csvCell — formula-injection neutralization", () => {
  it("prefixes a leading equals sign with an apostrophe", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
  });

  it("prefixes a leading plus sign", () => {
    expect(csvCell("+1+1")).toBe("'+1+1");
  });

  it("prefixes a leading minus sign", () => {
    expect(csvCell("-2+3")).toBe("'-2+3");
  });

  it("prefixes a leading @ sign", () => {
    // The cell also contains a comma, so RFC 4180 quoting applies on top
    // of the formula-neutralization prefix — both defenses are correct
    // to fire on the same cell.
    expect(csvCell("@SUM(1;2)")).toBe("'@SUM(1;2)");
    expect(csvCell("@SUM(1,2)")).toBe('"\'@SUM(1,2)"');
  });

  it("prefixes a leading tab", () => {
    // A bare tab isn't one of RFC 4180's mandatory-quote characters
    // (comma/quote/CR/LF), so no quoting is added on top of the prefix.
    expect(csvCell("\t=cmd")).toBe("'\t=cmd");
  });

  it("prefixes a leading carriage return, which also triggers RFC 4180 quoting since \\r is itself a quote-mandatory character", () => {
    expect(csvCell("\r=cmd")).toBe('"\'\r=cmd"');
  });

  it("leaves an ordinary cell untouched", () => {
    expect(csvCell("Example Corp")).toBe("Example Corp");
    expect(csvCell("12345.00")).toBe("12345.00");
  });

  it("does not neutralize a minus/plus/equals sign that is not the first character", () => {
    expect(csvCell("Total = 500")).toBe("Total = 500");
    expect(csvCell("A-B")).toBe("A-B");
  });

  it("passes non-Latin UTF-8 text (Tamil) through unchanged, with no mangled bytes", () => {
    const tamil = "வருமான வரி அறிக்கை";
    expect(csvCell(tamil)).toBe(tamil);
  });
});

describe("csvCell — RFC 4180 quoting", () => {
  it("quotes a cell containing a comma", () => {
    expect(csvCell("Acme, Inc.")).toBe('"Acme, Inc."');
  });

  it("quotes a cell containing a double quote and doubles the internal quote", () => {
    expect(csvCell('Say "hello"')).toBe('"Say ""hello"""');
  });

  it("quotes a cell containing a newline", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("applies both formula-neutralization and quoting together when both are needed", () => {
    expect(csvCell("=A1,B1")).toBe('"\'=A1,B1"');
  });
});

describe("toCsv", () => {
  type Row = { name: string; amount: string };
  const columns = [
    { header: "Name", value: (r: Row) => r.name },
    { header: "Amount", value: (r: Row) => r.amount },
  ];

  it("renders a header row followed by one row per item, CRLF-terminated", () => {
    const csv = toCsv<Row>(
      [
        { name: "Example Corp", amount: "1000.00" },
        { name: "Other Ltd", amount: "500.00" },
      ],
      columns,
    );
    expect(csv).toBe(
      "Name,Amount\r\nExample Corp,1000.00\r\nOther Ltd,500.00\r\n",
    );
  });

  it("renders just the header row for an empty dataset", () => {
    const csv = toCsv<Row>([], columns);
    expect(csv).toBe("Name,Amount\r\n");
  });

  it("neutralizes a formula-injection attempt in any data cell, not just known-risky columns", () => {
    const csv = toCsv<Row>(
      [{ name: "=cmd|'/c calc'!A1", amount: "0" }],
      columns,
    );
    expect(csv).toContain("'=cmd");
  });

  it("preserves non-Latin UTF-8 text (Tamil) in a data row", () => {
    const csv = toCsv<Row>(
      [{ name: "வருமான வரி அறிக்கை", amount: "1000.00" }],
      columns,
    );
    expect(csv).toContain("வருமான வரி அறிக்கை");
  });
});
