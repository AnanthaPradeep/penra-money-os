import { computeDescriptionMatchKey } from "@/lib/bank-import/normalize";
import type { ImportRule } from "@/lib/bank-import/mapping";
import type { Money } from "@/lib/money/decimal";
import type { RowDirection } from "@/lib/bank-import/types";

/**
 * Pure evaluation of a user's own saved categorization rules against one
 * normalized row — deterministic only, no AI, no fuzzy scoring. A rule
 * only ever *suggests* kind/category/payee/notes/exclusion; nothing here
 * writes to the database or decides what gets posted (see
 * apply_statement_import_row_analysis, which the caller uses to persist
 * whatever this function returns as a pre-fill the user can still edit).
 */

export type RowForRuleEvaluation = {
  description: string;
  reference: string | null;
  direction: RowDirection | null;
  accountId: string;
  amount: Money | null;
};

function ruleMatchesRow(rule: ImportRule, row: RowForRuleEvaluation): boolean {
  if (!rule.isActive) {
    return false;
  }
  if (rule.accountId && rule.accountId !== row.accountId) {
    return false;
  }
  if (rule.directionFilter && rule.directionFilter !== row.direction) {
    return false;
  }
  if (
    rule.minAmount &&
    (!row.amount || row.amount.abs().lessThan(rule.minAmount))
  ) {
    return false;
  }
  if (
    rule.maxAmount &&
    (!row.amount || row.amount.abs().greaterThan(rule.maxAmount))
  ) {
    return false;
  }

  const key = computeDescriptionMatchKey(row.description);
  const valueKey = computeDescriptionMatchKey(rule.matchValue);

  switch (rule.matchField) {
    case "description_contains":
      return valueKey.length > 0 && key.includes(valueKey);
    case "description_starts_with":
      return valueKey.length > 0 && key.startsWith(valueKey);
    case "description_exact":
      return valueKey === key;
    case "reference_prefix":
      return Boolean(
        row.reference &&
        rule.matchValue.length > 0 &&
        row.reference
          .toLowerCase()
          .startsWith(rule.matchValue.trim().toLowerCase()),
      );
    default:
      return false;
  }
}

export type RuleEvaluationResult =
  | { status: "matched"; rule: ImportRule }
  | { status: "conflict"; rules: ImportRule[] }
  | { status: "no_match" };

/**
 * Highest-priority matching rule wins. If more than one rule shares the
 * top priority and they disagree on what to suggest, that is a genuine
 * conflict — the row is left for manual review rather than silently
 * picking one, per the spec's "conflicting rules -> review state".
 */
export function evaluateImportRules(
  row: RowForRuleEvaluation,
  rules: ImportRule[],
): RuleEvaluationResult {
  const matching = rules.filter((rule) => ruleMatchesRow(rule, row));
  if (matching.length === 0) {
    return { status: "no_match" };
  }

  const maxPriority = Math.max(...matching.map((rule) => rule.priority));
  const topMatches = matching.filter((rule) => rule.priority === maxPriority);

  if (topMatches.length === 1) {
    const [rule] = topMatches;
    if (!rule) {
      return { status: "no_match" };
    }
    return { status: "matched", rule };
  }

  const signatures = new Set(
    topMatches.map((rule) =>
      JSON.stringify([
        rule.exclude,
        rule.suggestedTransactionType,
        rule.suggestedCategoryId,
        rule.suggestedPayeeId,
      ]),
    ),
  );

  if (signatures.size > 1) {
    return { status: "conflict", rules: topMatches };
  }

  const [rule] = topMatches;
  if (!rule) {
    return { status: "no_match" };
  }
  return { status: "matched", rule };
}
