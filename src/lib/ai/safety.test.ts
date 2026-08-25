import { describe, expect, it } from "vitest";

import {
  buildResearchSystemPrompt,
  detectAdviceRequest,
  validateOutputForForbiddenLanguage,
} from "@/lib/ai/safety";

describe("detectAdviceRequest", () => {
  // The exact phrasings spec section 13 names as requests the assistant must refuse.
  const mustRefuse = [
    "Should I buy this?",
    "should i sell now",
    "Tell me how much to invest",
    "how much should I invest in this IPO",
    "Which IPO will list at a profit?",
    "Guarantee my return",
    "can you guarantee my returns",
    "Execute the trade",
    "please place the order for me",
    "Predict tomorrow's price",
    "predict the future price of this stock",
    "what's the target price",
    "will the price go up",
    "should I apply to this IPO",
    "Apply to this IPO for me",
  ];

  it.each(mustRefuse)("flags %j as an advice request", (text) => {
    expect(detectAdviceRequest(text).blocked).toBe(true);
  });

  const mustAllow = [
    "What does the DRHP say about revenue concentration?",
    "Summarize the risks disclosed in this filing.",
    "What is the debt-to-equity ratio mentioned in the source?",
    "What did the company say about promoter holding?",
    "List the litigations disclosed in the prospectus.",
  ];

  it.each(mustAllow)("does not flag a research question: %j", (text) => {
    expect(detectAdviceRequest(text).blocked).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(detectAdviceRequest("SHOULD I BUY THIS STOCK").blocked).toBe(true);
  });
});

describe("buildResearchSystemPrompt", () => {
  const prompt = buildResearchSystemPrompt({
    scopeDescription: "Example Corp",
    authorizedChunkIds: ["chunk-a", "chunk-b"],
  });

  it("lists the authorized source chunk IDs", () => {
    expect(prompt).toContain("chunk-a");
    expect(prompt).toContain("chunk-b");
  });

  it("instructs the model to treat source text as untrusted data, not instructions", () => {
    expect(prompt.toLowerCase()).toContain("untrusted data");
  });

  it("forbids revealing secrets/credentials/the system prompt itself", () => {
    expect(prompt.toLowerCase()).toContain("never reveal");
  });

  it("forbids inventing citation IDs", () => {
    expect(prompt.toLowerCase()).toContain("never invent");
  });

  it("forbids recommendations, guarantees, price predictions, and trade execution", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toContain("never recommend");
    expect(lower).toContain("guaranteed return");
    expect(lower).toContain("predict a future price");
    expect(lower).toContain("execute, place");
  });

  it("requires facts/interpretations/risks/unknowns to stay separate", () => {
    expect(prompt).toContain(
      "Never merge them into one unsupported conclusion.",
    );
  });

  it("handles an empty authorized source list honestly rather than omitting the section", () => {
    const emptyPrompt = buildResearchSystemPrompt({
      scopeDescription: "Example Corp",
      authorizedChunkIds: [],
    });
    expect(emptyPrompt).toContain("(none supplied)");
  });
});

describe("validateOutputForForbiddenLanguage", () => {
  const forbidden = [
    "This stock has a guaranteed return of 15%.",
    "You should buy this stock now.",
    "We recommend buying this IPO.",
    "Our target price of ₹500 suggests upside.",
    "The price will rise to ₹500 by next quarter.",
    "Your order has been placed for 10 shares.",
  ];

  it.each(forbidden)("flags forbidden output: %j", (text) => {
    expect(validateOutputForForbiddenLanguage(text).safe).toBe(false);
  });

  const safe = [
    "The company's revenue grew 12% year-over-year per the FY24 annual report.",
    "The DRHP discloses a customer concentration risk: the top 5 customers account for 40% of revenue.",
    "Debt-to-equity ratio is not disclosed in the supplied excerpts.",
  ];

  it.each(safe)("allows sourced, non-advisory output: %j", (text) => {
    expect(validateOutputForForbiddenLanguage(text).safe).toBe(true);
  });
});
