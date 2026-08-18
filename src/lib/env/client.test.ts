import { describe, expect, it } from "vitest";

import { getClientEnv } from "@/lib/env/client";

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake_key_for_tests",
};

describe("getClientEnv", () => {
  it("accepts a correctly shaped public environment", () => {
    const env = getClientEnv(VALID_ENV);

    expect(env).toEqual(VALID_ENV);
  });

  it("rejects a missing URL", () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _omit, ...rest } = VALID_ENV;

    expect(() => getClientEnv(rest)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a missing publishable key", () => {
    const { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: _omit, ...rest } = VALID_ENV;

    expect(() => getClientEnv(rest)).toThrow(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("rejects a URL that is not a valid URL", () => {
    expect(() =>
      getClientEnv({ ...VALID_ENV, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow();
  });

  it("rejects an empty publishable key", () => {
    expect(() =>
      getClientEnv({
        ...VALID_ENV,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toThrow();
  });

  it("never includes the actual values in its error message", () => {
    try {
      getClientEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "super-secret-marker-value",
      });
      throw new Error("expected getClientEnv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : "";
      expect(message).not.toContain("super-secret-marker-value");
      expect(message).not.toContain("not-a-url");
    }
  });
});
