import type { AiSectionType } from "@/lib/ai/types";

export type CitedOutputSection = {
  sectionType: AiSectionType;
  content: string;
  citations: readonly string[];
};

export type CitationValidationResult =
  | { valid: true }
  | {
      valid: false;
      /** section index -> citation ids that aren't in the authorized set. */
      invalidCitationsBySection: ReadonlyMap<number, readonly string[]>;
    };

/**
 * Pure re-implementation of the check complete_ai_job() runs at the
 * database layer (see the Phase 10 migration section 14) — every citation
 * in every output section must reference a chunk id in the job's
 * authorized source set. Used client/server-side for immediate UI
 * feedback before ever calling the database; the database's own check
 * remains the authoritative, non-bypassable enforcement (never trust this
 * copy alone — see the pgTAP test that rejects a completion attempt with
 * a fabricated citation).
 */
export function validateCitations(
  sections: readonly CitedOutputSection[],
  authorizedChunkIds: readonly string[],
): CitationValidationResult {
  const authorized = new Set(authorizedChunkIds);
  const invalidBySection = new Map<number, readonly string[]>();

  sections.forEach((section, index) => {
    const invalid = section.citations.filter((id) => !authorized.has(id));
    if (invalid.length > 0) {
      invalidBySection.set(index, invalid);
    }
  });

  if (invalidBySection.size === 0) {
    return { valid: true };
  }
  return { valid: false, invalidCitationsBySection: invalidBySection };
}

/**
 * The deduplicated union of every section's citations — rendered app-side
 * as the "source_citations" view the spec describes; never stored as its
 * own database row.
 */
export function collectAllCitations(
  sections: readonly CitedOutputSection[],
): string[] {
  const seen = new Set<string>();
  for (const section of sections) {
    for (const id of section.citations) {
      seen.add(id);
    }
  }
  return [...seen];
}

/**
 * A factual claim (facts/interpretations/risks sections) with zero
 * citations has nowhere to point — the spec requires such claims to be
 * moved to "unknowns" instead. This flags the case for the human-review
 * UI; it does not move content automatically (only the model/author does
 * that before submission).
 */
export function sectionsRequiringCitationButMissingOne(
  sections: readonly CitedOutputSection[],
): number[] {
  const citedSectionTypes: readonly AiSectionType[] = [
    "facts",
    "interpretations",
    "risks",
  ];
  const indices: number[] = [];
  sections.forEach((section, index) => {
    if (
      citedSectionTypes.includes(section.sectionType) &&
      section.citations.length === 0 &&
      section.content.trim().length > 0
    ) {
      indices.push(index);
    }
  });
  return indices;
}
