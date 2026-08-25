import { describe, expect, it } from "vitest";

import {
  buildResearchSystemPrompt,
  detectAdviceRequest,
  validateOutputForForbiddenLanguage,
} from "./safety";

// This file's logic is a hand-kept Deno-compatible duplicate of
// src/lib/ai/safety.ts (see this file's own header) — see that module's
// much more exhaustive test suite for full coverage of the phrase list.
// These tests just confirm the duplicate behaves identically on the
// spec-named examples and the worker-specific JSON-response instruction.

describe("detectAdviceRequest", () => {
  const mustRefuse = [
    "Should I buy this?",
    "Guarantee my return",
    "Execute the trade",
    "Predict tomorrow's price",
    "Which IPO will list at a profit?",
  ];

  it.each(mustRefuse)("flags %j", (text) => {
    expect(detectAdviceRequest(text).blocked).toBe(true);
  });

  it("allows a research question", () => {
    expect(
      detectAdviceRequest("What does the filing say about revenue?").blocked,
    ).toBe(false);
  });
});

describe("buildResearchSystemPrompt", () => {
  it("instructs the model to respond with only the required JSON shape", () => {
    const prompt = buildResearchSystemPrompt({ authorizedChunkIds: ["c1"] });
    expect(prompt).toContain('"facts"');
    expect(prompt).toContain('"questions_for_review"');
    expect(prompt.toLowerCase()).toContain("only a single json object");
  });

  it("embeds the prompt-injection defence — source text cannot override instructions", () => {
    const prompt = buildResearchSystemPrompt({ authorizedChunkIds: [] });
    expect(prompt.toLowerCase()).toContain(
      "ignore prior instructions".toLowerCase(),
    );
    expect(prompt.toLowerCase()).toContain("untrusted data");
  });
});

describe("validateOutputForForbiddenLanguage", () => {
  it("flags a guaranteed-return claim leaking through despite instructions", () => {
    expect(
      validateOutputForForbiddenLanguage("This has a guaranteed return.").safe,
    ).toBe(false);
  });

  it("allows sourced, non-advisory output", () => {
    expect(
      validateOutputForForbiddenLanguage(
        "The filing discloses a customer concentration risk.",
      ).safe,
    ).toBe(true);
  });
});
