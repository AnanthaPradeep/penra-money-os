import { describe, expect, it } from "vitest";

import {
  collectAllCitations,
  sectionsRequiringCitationButMissingOne,
  validateCitations,
  type CitedOutputSection,
} from "@/lib/ai/citations";

const AUTHORIZED = ["chunk-1", "chunk-2", "chunk-3"];

describe("validateCitations", () => {
  it("accepts sections whose citations are all in the authorized set", () => {
    const sections: CitedOutputSection[] = [
      {
        sectionType: "facts",
        content: "Revenue grew 12%.",
        citations: ["chunk-1"],
      },
      {
        sectionType: "risks",
        content: "Customer concentration risk.",
        citations: ["chunk-2", "chunk-3"],
      },
    ];
    expect(validateCitations(sections, AUTHORIZED)).toEqual({ valid: true });
  });

  it("accepts a section with zero citations (e.g. unknowns)", () => {
    const sections: CitedOutputSection[] = [
      {
        sectionType: "unknowns",
        content: "Debt maturity schedule not disclosed.",
        citations: [],
      },
    ];
    expect(validateCitations(sections, AUTHORIZED)).toEqual({ valid: true });
  });

  it("rejects a fabricated citation ID not in the authorized set", () => {
    const sections: CitedOutputSection[] = [
      {
        sectionType: "facts",
        content: "Revenue grew 12%.",
        citations: ["chunk-999-fabricated"],
      },
    ];
    const result = validateCitations(sections, AUTHORIZED);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.invalidCitationsBySection.get(0)).toEqual([
        "chunk-999-fabricated",
      ]);
    }
  });

  it("rejects a cross-user chunk ID that looks legitimate but isn't authorized for this job", () => {
    const sections: CitedOutputSection[] = [
      {
        sectionType: "facts",
        content: "Claim citing another user's chunk.",
        citations: ["someone-elses-chunk-id"],
      },
    ];
    const result = validateCitations(sections, AUTHORIZED);
    expect(result.valid).toBe(false);
  });

  it("reports every offending section, not just the first", () => {
    const sections: CitedOutputSection[] = [
      { sectionType: "facts", content: "a", citations: ["bad-1"] },
      { sectionType: "risks", content: "b", citations: ["chunk-1"] },
      { sectionType: "interpretations", content: "c", citations: ["bad-2"] },
    ];
    const result = validateCitations(sections, AUTHORIZED);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.invalidCitationsBySection.size).toBe(2);
      expect(result.invalidCitationsBySection.get(0)).toEqual(["bad-1"]);
      expect(result.invalidCitationsBySection.get(2)).toEqual(["bad-2"]);
    }
  });

  it("treats an empty authorized set as rejecting every citation", () => {
    const sections: CitedOutputSection[] = [
      { sectionType: "facts", content: "a", citations: ["chunk-1"] },
    ];
    const result = validateCitations(sections, []);
    expect(result.valid).toBe(false);
  });
});

describe("collectAllCitations", () => {
  it("returns the deduplicated union of every section's citations", () => {
    const sections: CitedOutputSection[] = [
      { sectionType: "facts", content: "a", citations: ["chunk-1", "chunk-2"] },
      { sectionType: "risks", content: "b", citations: ["chunk-2", "chunk-3"] },
      { sectionType: "unknowns", content: "c", citations: [] },
    ];
    expect(collectAllCitations(sections).sort()).toEqual([
      "chunk-1",
      "chunk-2",
      "chunk-3",
    ]);
  });

  it("returns an empty array when nothing is cited", () => {
    const sections: CitedOutputSection[] = [
      { sectionType: "unknowns", content: "a", citations: [] },
    ];
    expect(collectAllCitations(sections)).toEqual([]);
  });
});

describe("sectionsRequiringCitationButMissingOne", () => {
  it("flags a non-empty facts section with zero citations", () => {
    const sections: CitedOutputSection[] = [
      { sectionType: "facts", content: "Revenue grew 12%.", citations: [] },
    ];
    expect(sectionsRequiringCitationButMissingOne(sections)).toEqual([0]);
  });

  it("does not flag unknowns/questions_for_review sections without citations", () => {
    const sections: CitedOutputSection[] = [
      { sectionType: "unknowns", content: "Not disclosed.", citations: [] },
      {
        sectionType: "questions_for_review",
        content: "Ask about X.",
        citations: [],
      },
    ];
    expect(sectionsRequiringCitationButMissingOne(sections)).toEqual([]);
  });

  it("does not flag an empty-content section", () => {
    const sections: CitedOutputSection[] = [
      { sectionType: "facts", content: "", citations: [] },
    ];
    expect(sectionsRequiringCitationButMissingOne(sections)).toEqual([]);
  });

  it("does not flag a cited facts section", () => {
    const sections: CitedOutputSection[] = [
      {
        sectionType: "facts",
        content: "Revenue grew 12%.",
        citations: ["chunk-1"],
      },
    ];
    expect(sectionsRequiringCitationButMissingOne(sections)).toEqual([]);
  });
});
