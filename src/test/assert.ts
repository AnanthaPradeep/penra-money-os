/**
 * A typed, runtime-checked alternative to the `!` non-null assertion for
 * test code — throws a clear, specific error immediately if the value is
 * actually missing (rather than `!`'s "trust me" that silently produces a
 * cryptic "Cannot read properties of undefined" a few lines later), and
 * narrows the return type without ever using assertion syntax.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = "Expected value to be defined",
): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}
