import { describe, expect, it } from "vitest";

import { computeAiJobInputHash, computeChunkContentHash } from "@/lib/ai/hash";

describe("computeAiJobInputHash", () => {
  const base = {
    jobKind: "document_summary" as const,
    promptTemplateVersion: "v1",
    chunkIds: ["chunk-b", "chunk-a"],
  };

  it("is deterministic for identical input", () => {
    expect(computeAiJobInputHash(base)).toBe(computeAiJobInputHash(base));
  });

  it("is independent of chunk ID order — this is what makes duplicate-concurrent detection work", () => {
    const a = computeAiJobInputHash({
      ...base,
      chunkIds: ["chunk-a", "chunk-b"],
    });
    const b = computeAiJobInputHash({
      ...base,
      chunkIds: ["chunk-b", "chunk-a"],
    });
    expect(a).toBe(b);
  });

  it("differs when the chunk set differs", () => {
    const a = computeAiJobInputHash({ ...base, chunkIds: ["chunk-a"] });
    const b = computeAiJobInputHash({
      ...base,
      chunkIds: ["chunk-a", "chunk-c"],
    });
    expect(a).not.toBe(b);
  });

  it("differs when the job kind differs", () => {
    const a = computeAiJobInputHash(base);
    const b = computeAiJobInputHash({ ...base, jobKind: "risk_extraction" });
    expect(a).not.toBe(b);
  });

  it("differs when the prompt template version differs", () => {
    const a = computeAiJobInputHash(base);
    const b = computeAiJobInputHash({ ...base, promptTemplateVersion: "v2" });
    expect(a).not.toBe(b);
  });

  it("differs when the question text differs (research_question jobs)", () => {
    const a = computeAiJobInputHash({
      ...base,
      jobKind: "research_question",
      questionText: "What is the debt-to-equity ratio?",
    });
    const b = computeAiJobInputHash({
      ...base,
      jobKind: "research_question",
      questionText: "What is the revenue growth rate?",
    });
    expect(a).not.toBe(b);
  });

  it("normalizes question text case/whitespace so trivial rephrasing still dedupes", () => {
    const a = computeAiJobInputHash({
      ...base,
      questionText: "  What is the Debt Ratio?  ",
    });
    const b = computeAiJobInputHash({
      ...base,
      questionText: "what is the debt ratio?",
    });
    expect(a).toBe(b);
  });

  it("treats a missing question text the same as an empty one", () => {
    const a = computeAiJobInputHash(base);
    const b = computeAiJobInputHash({ ...base, questionText: null });
    expect(a).toBe(b);
  });

  it("produces a hex-encoded sha256 digest", () => {
    expect(computeAiJobInputHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("computeChunkContentHash", () => {
  it("is deterministic", () => {
    const text = "Revenue grew 12% year-over-year.";
    expect(computeChunkContentHash(text)).toBe(computeChunkContentHash(text));
  });

  it("differs for different content", () => {
    expect(computeChunkContentHash("a")).not.toBe(computeChunkContentHash("b"));
  });

  it("produces a hex-encoded sha256 digest", () => {
    expect(computeChunkContentHash("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
