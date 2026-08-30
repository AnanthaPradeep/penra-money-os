import { Decimal } from "@/lib/money/decimal";
import type { Json } from "@/types/database.types";

/**
 * A plain `instanceof Map` check narrows to `Map<any, any>` — TypeScript
 * has no way to recover the generic parameters from a runtime check
 * alone, so it defaults them to `any` rather than `unknown`. This
 * explicit predicate narrows to `Map<unknown, unknown>` instead, keeping
 * every value derived from it out of `any`.
 */
function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

/**
 * Recursively converts an already-computed engine result (full of Money/
 * Decimal instances, e.g. a RegimeComparisonResult or CapitalGainsReport)
 * into a plain JSON-safe structure for storage in
 * tax_report_snapshots.snapshot_data — every Decimal becomes its exact
 * decimal string via `.toString()`, never a JS `number` (which would risk
 * floating-point precision loss on write). Arrays and Maps are walked
 * element-by-element; a Map becomes a plain object keyed by its own
 * string keys (Maps are not valid JSON on their own).
 */
export function serializeForSnapshot(value: unknown): Json {
  if (value instanceof Decimal) {
    return value.toString();
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeForSnapshot(item));
  }
  if (isMap(value)) {
    const out: Record<string, Json> = {};
    for (const [key, mapValue] of value.entries()) {
      out[String(key)] = serializeForSnapshot(mapValue);
    }
    return out;
  }
  if (typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [key, propertyValue] of Object.entries(value)) {
      out[key] = serializeForSnapshot(propertyValue);
    }
    return out;
  }
  // Function, symbol, bigint — none of these appear in this app's engine
  // results; falling back to null rather than throwing keeps this a safe
  // best-effort serializer for anything unexpected.
  return null;
}
