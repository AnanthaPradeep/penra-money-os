import { z } from "zod";

/**
 * Public, browser-safe Supabase configuration only.
 *
 * These are the two values Next.js inlines into the client bundle
 * (`NEXT_PUBLIC_*`). Nothing secret belongs in this module or its schema —
 * see docs/phase-1/03-supabase-foundation.md for the public/secret split.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates and returns the public Supabase environment configuration.
 *
 * Intentionally lazy: this only runs (and only throws) when something
 * actually needs a Supabase client. Importing this module — or any module
 * that transitively imports it — must never fail just because Supabase
 * hasn't been configured yet, so unrelated pages/tests keep working.
 *
 * @param source Defaults to `process.env`. Overridable for testing.
 */
export function getClientEnv(
  source: Record<string, string | undefined> = process.env,
): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    // Field names and validation messages only — never the values themselves.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      "Invalid or missing Supabase public environment configuration:\n" +
        `${problems}\n\n` +
        "Copy .env.example to .env.local and fill in your Supabase project's " +
        "URL and publishable key, then restart the dev server. " +
        "See docs/phase-1/02-local-development.md for setup instructions.",
    );
  }

  return result.data;
}
