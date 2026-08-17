// @vitest-environment node
//
// Runs in the Node environment (no `window` global) so that the
// `server-only` guard imported by src/lib/supabase/server.ts behaves as it
// would on the real server, instead of throwing because a browser-like
// global is present — proving the client/server boundary safeguard works.
import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` resolves to a throwing module unless the bundler sets the
// "react-server" export condition (which only Next.js's own build does).
// Under Vitest we mock it to a no-op, same as the official guidance for
// unit testing server-only modules outside of Next's build pipeline.
vi.mock("server-only", () => ({}));

type FakeCookie = { name: string; value: string };
type CookiesAdapter = {
  getAll: () => FakeCookie[];
  setAll: (cookiesToSet: Array<FakeCookie & { options?: unknown }>) => void;
};

const createServerClientMock = vi.fn(
  (_url: string, _key: string, _options: { cookies: CookiesAdapter }) => ({
    __fakeSupabaseClient: true,
  }),
);

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

const fakeCookieStore = {
  getAll: vi.fn(() => [{ name: "example", value: "cookie" }]),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => fakeCookieStore),
}));

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake_key_for_tests",
};

beforeEach(() => {
  createServerClientMock.mockClear();
  fakeCookieStore.getAll.mockClear();
  fakeCookieStore.set.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", VALID_ENV.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    VALID_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
});

describe("createSupabaseServerClient", () => {
  it("calls createServerClient with only the public URL and publishable key", async () => {
    const { createSupabaseServerClient } =
      await import("@/lib/supabase/server");

    await createSupabaseServerClient();

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createServerClientMock.mock.calls[0]!;
    expect(url).toBe(VALID_ENV.NEXT_PUBLIC_SUPABASE_URL);
    expect(key).toBe(VALID_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    expect(options.cookies).toBeDefined();
  });

  it("reads cookies from Next.js's request-scoped cookie store", async () => {
    const { createSupabaseServerClient } =
      await import("@/lib/supabase/server");

    await createSupabaseServerClient();

    const options = createServerClientMock.mock.calls[0]![2];
    const all = options.cookies.getAll();

    expect(fakeCookieStore.getAll).toHaveBeenCalled();
    expect(all).toEqual([{ name: "example", value: "cookie" }]);
  });

  it("throws a clear error instead of contacting Supabase when configuration is missing", async () => {
    vi.unstubAllEnvs();

    const { createSupabaseServerClient } =
      await import("@/lib/supabase/server");

    await expect(createSupabaseServerClient()).rejects.toThrow(
      /Supabase public environment configuration/,
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
