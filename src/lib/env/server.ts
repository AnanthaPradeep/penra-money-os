import "server-only";

import { z } from "zod";

/**
 * Server-only configuration. Never re-exported through a `NEXT_PUBLIC_*`
 * name and never imported from client code — the `server-only` import
 * above makes any accidental client import fail the build loudly.
 */
const serverEnvSchema = z.object({
  // `z.url()` accepts any URL scheme by default (including `ftp:` or even
  // `javascript:`) — the explicit `protocol` constraint is required to
  // actually enforce "absolute HTTP/HTTPS URL".
  APP_URL: z
    .url({
      protocol: /^https?$/,
      error:
        "APP_URL must be an absolute http(s) URL, e.g. http://localhost:3000.",
    })
    .refine(
      (value) => !value.endsWith("/"),
      "APP_URL must not end with a trailing slash.",
    ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates and returns server-only environment configuration.
 *
 * Intentionally lazy, same as `getClientEnv` — this only runs (and only
 * throws) when something actually needs it (building an auth redirect
 * URL), never merely because the module was imported.
 *
 * @param source Defaults to `process.env`. Overridable for testing.
 */
export function getServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse({ APP_URL: source.APP_URL });

  if (!result.success) {
    // Field names and validation messages only — never the values themselves.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      "Invalid or missing server environment configuration:\n" +
        `${problems}\n\n` +
        "Set APP_URL in .env.local, e.g. APP_URL=http://localhost:3000. " +
        "See docs/phase-1/02-local-development.md for setup instructions.",
    );
  }

  return result.data;
}
