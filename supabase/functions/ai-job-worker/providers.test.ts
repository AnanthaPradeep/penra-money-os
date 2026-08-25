import { describe, expect, it } from "vitest";

import {
  buildAnthropicRequestBody,
  buildOpenAiRequestBody,
  demoteUncitedClaims,
  findInvalidCitations,
  isRecord,
  parseAnthropicResponse,
  parseOpenAiResponse,
  parseStructuredOutput,
  type StructuredOutput,
} from "./providers";

describe("isRecord", () => {
  it("accepts a plain object and rejects arrays/null/primitives", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});

describe("buildOpenAiRequestBody", () => {
  it("builds a chat-completions body requesting a JSON object response", () => {
    const body = buildOpenAiRequestBody(
      "gpt-4o-mini",
      [
        { role: "system", content: "sys" },
        { role: "user", content: "usr" },
      ],
      2000,
    );
    expect(body).toEqual({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "usr" },
      ],
      max_tokens: 2000,
      temperature: 0,
      response_format: { type: "json_object" },
    });
  });
});

describe("parseOpenAiResponse", () => {
  it("extracts text and usage from a well-formed response", () => {
    const body = {
      choices: [{ message: { role: "assistant", content: "{}" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
    expect(parseOpenAiResponse(body)).toEqual({
      text: "{}",
      inputTokens: 10,
      outputTokens: 5,
    });
  });

  it("defaults token counts to 0 when usage is missing", () => {
    const body = { choices: [{ message: { content: "{}" } }] };
    expect(parseOpenAiResponse(body)).toEqual({
      text: "{}",
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it("returns null for a response with no choices", () => {
    expect(parseOpenAiResponse({ choices: [] })).toBeNull();
  });

  it("returns null for a malformed body", () => {
    expect(parseOpenAiResponse(null)).toBeNull();
    expect(parseOpenAiResponse({ choices: [{ message: {} }] })).toBeNull();
  });
});

describe("buildAnthropicRequestBody", () => {
  it("builds a messages body with a top-level system prompt", () => {
    const body = buildAnthropicRequestBody(
      "claude-haiku-4-5",
      "sys",
      "usr",
      2000,
    );
    expect(body).toEqual({
      model: "claude-haiku-4-5",
      system: "sys",
      messages: [{ role: "user", content: "usr" }],
      max_tokens: 2000,
      temperature: 0,
    });
  });
});

describe("parseAnthropicResponse", () => {
  it("extracts text and usage from a well-formed response", () => {
    const body = {
      content: [{ type: "text", text: "{}" }],
      usage: { input_tokens: 8, output_tokens: 4 },
    };
    expect(parseAnthropicResponse(body)).toEqual({
      text: "{}",
      inputTokens: 8,
      outputTokens: 4,
    });
  });

  it("returns null for a response with no content blocks", () => {
    expect(parseAnthropicResponse({ content: [] })).toBeNull();
  });

  it("returns null for a malformed body", () => {
    expect(parseAnthropicResponse(null)).toBeNull();
    expect(parseAnthropicResponse({ content: [{ type: "text" }] })).toBeNull();
  });
});

describe("parseStructuredOutput", () => {
  it("parses a well-formed structured JSON response", () => {
    const raw = JSON.stringify({
      facts: [{ content: "Revenue grew 12%.", citations: ["chunk-1"] }],
      interpretations: [],
      risks: [],
      unknowns: [{ content: "Debt maturity not disclosed." }],
      questions_for_review: [],
    });
    const parsed = parseStructuredOutput(raw);
    expect(parsed?.facts).toEqual([
      { content: "Revenue grew 12%.", citations: ["chunk-1"] },
    ]);
    expect(parsed?.unknowns).toEqual([
      { content: "Debt maturity not disclosed.", citations: [] },
    ]);
  });

  it("returns null for non-JSON text (e.g. the model ignored the format instruction)", () => {
    expect(parseStructuredOutput("Sure, here is a summary: ...")).toBeNull();
  });

  it("returns null for JSON that isn't an object", () => {
    expect(parseStructuredOutput("[1,2,3]")).toBeNull();
  });

  it("treats a missing section key as an empty array rather than throwing", () => {
    const parsed = parseStructuredOutput(JSON.stringify({ facts: [] }));
    expect(parsed?.risks).toEqual([]);
    expect(parsed?.questions_for_review).toEqual([]);
  });

  it("drops an entry with empty/whitespace-only content", () => {
    const raw = JSON.stringify({ facts: [{ content: "   ", citations: [] }] });
    expect(parseStructuredOutput(raw)?.facts).toEqual([]);
  });

  it("filters non-string citation entries rather than trusting them", () => {
    const raw = JSON.stringify({
      facts: [{ content: "x", citations: ["chunk-1", 42, null] }],
    });
    expect(parseStructuredOutput(raw)?.facts[0]?.citations).toEqual([
      "chunk-1",
    ]);
  });
});

function emptyOutput(): StructuredOutput {
  return {
    facts: [],
    interpretations: [],
    risks: [],
    unknowns: [],
    questions_for_review: [],
  };
}

describe("findInvalidCitations", () => {
  it("returns an empty array when every citation is authorized", () => {
    const output = {
      ...emptyOutput(),
      facts: [{ content: "x", citations: ["chunk-1"] }],
    };
    expect(findInvalidCitations(output, ["chunk-1", "chunk-2"])).toEqual([]);
  });

  it("flags a fabricated citation ID", () => {
    const output = {
      ...emptyOutput(),
      facts: [{ content: "x", citations: ["chunk-fake"] }],
    };
    expect(findInvalidCitations(output, ["chunk-1"])).toEqual(["chunk-fake"]);
  });

  it("checks every section, not just facts", () => {
    const output: StructuredOutput = {
      ...emptyOutput(),
      interpretations: [{ content: "x", citations: ["bad"] }],
      risks: [{ content: "y", citations: ["chunk-1"] }],
    };
    expect(findInvalidCitations(output, ["chunk-1"])).toEqual(["bad"]);
  });
});

describe("demoteUncitedClaims", () => {
  it("moves an uncited fact into unknowns", () => {
    const output: StructuredOutput = {
      ...emptyOutput(),
      facts: [{ content: "Uncited claim.", citations: [] }],
    };
    const result = demoteUncitedClaims(output);
    expect(result.facts).toEqual([]);
    expect(result.unknowns).toEqual([
      { content: "Uncited claim.", citations: [] },
    ]);
  });

  it("keeps a cited fact in place", () => {
    const output: StructuredOutput = {
      ...emptyOutput(),
      facts: [{ content: "Cited claim.", citations: ["chunk-1"] }],
    };
    const result = demoteUncitedClaims(output);
    expect(result.facts).toEqual([
      { content: "Cited claim.", citations: ["chunk-1"] },
    ]);
    expect(result.unknowns).toEqual([]);
  });

  it("preserves existing unknowns and questions_for_review untouched", () => {
    const output: StructuredOutput = {
      ...emptyOutput(),
      unknowns: [{ content: "Already unknown.", citations: [] }],
      questions_for_review: [{ content: "A question.", citations: [] }],
    };
    const result = demoteUncitedClaims(output);
    expect(result.unknowns).toEqual([
      { content: "Already unknown.", citations: [] },
    ]);
    expect(result.questions_for_review).toEqual([
      { content: "A question.", citations: [] },
    ]);
  });

  it("demotes across interpretations and risks too", () => {
    const output: StructuredOutput = {
      ...emptyOutput(),
      interpretations: [{ content: "a", citations: [] }],
      risks: [{ content: "b", citations: [] }],
    };
    const result = demoteUncitedClaims(output);
    expect(result.interpretations).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.unknowns).toHaveLength(2);
  });
});
