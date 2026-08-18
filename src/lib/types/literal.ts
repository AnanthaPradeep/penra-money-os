/** Narrows `value` to `T` when it appears in `allowed`, without an assertion. */
export function isOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  const list: readonly string[] = allowed;
  return list.includes(value);
}

/**
 * Narrows a plain `string` column (constrained by a SQL CHECK, but only
 * typed as `string` by the generated Database type — Postgres CHECK
 * constraints, unlike native enum types, aren't reflected as literal
 * unions by the Supabase type generator) into one of the given literal
 * values. Throws if the database ever returns a value outside the known
 * set, since that would mean the CHECK constraint and this literal union
 * have drifted apart — a real schema mismatch, not a case to coerce past.
 */
export function assertLiteral<T extends string>(
  value: string,
  allowed: readonly T[],
  context: string,
): T {
  if (isOneOf(value, allowed)) {
    return value;
  }
  throw new Error(`${context}: unexpected value "${value}"`);
}
