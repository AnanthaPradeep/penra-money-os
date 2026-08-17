import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disables ESLint stylistic rules that would conflict with Prettier.
  // Formatting itself is Prettier's job (`pnpm format` / `pnpm format:check`).
  prettierConfig,
  {
    rules: {
      // Standard convention: a leading underscore marks an intentionally
      // unused binding (e.g. a destructured-out field, a mock's unused
      // parameter) without disabling the check entirely.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase CLI local/runtime artifacts:
    "supabase/.temp/**",
    // Coverage output:
    "coverage/**",
  ]),
]);

export default eslintConfig;
