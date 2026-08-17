import { beforeEach, describe, expect, it, vi } from "vitest";

const createBrowserClientMock = vi.fn(() => ({ __fakeSupabaseClient: true }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake_key_for_tests",
};

beforeEach(() => {
  createBrowserClientMock.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", VALID_ENV.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    VALID_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
});

describe("createSupabaseBrowserClient", () => {
  it("calls createBrowserClient with only the public URL and publishable key", async () => {
    const { createSupabaseBrowserClient } =
      await import("@/lib/supabase/client");

    createSupabaseBrowserClient();

    expect(createBrowserClientMock).toHaveBeenCalledTimes(1);
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      VALID_ENV.NEXT_PUBLIC_SUPABASE_URL,
      VALID_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  });

  it("throws a clear error instead of contacting Supabase when configuration is missing", async () => {
    vi.unstubAllEnvs();

    const { createSupabaseBrowserClient } =
      await import("@/lib/supabase/client");

    expect(() => createSupabaseBrowserClient()).toThrow(
      /Supabase public environment configuration/,
    );
    expect(createBrowserClientMock).not.toHaveBeenCalled();
  });
});
