import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getAuthenticatedUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: unknown[]) =>
    getAuthenticatedUserMock(...args),
}));

const getProfileForUserMock = vi.fn();
vi.mock("@/lib/profile/queries", () => ({
  getProfileForUser: (...args: unknown[]) => getProfileForUserMock(...args),
}));

const redirectMock = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT:${url}`);
  (error as unknown as { digest: string }).digest =
    `NEXT_REDIRECT;push;${url};307;`;
  throw error;
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("@/lib/profile/actions", () => ({
  updateProfileAction: vi.fn(),
}));

describe("ProfileSettingsPage", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { default: ProfileSettingsPage } =
      await import("@/app/app/settings/profile/page");

    await expect(ProfileSettingsPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith(
      "/login?next=/app/settings/profile",
    );
  });

  it("renders the profile form with the user's existing profile values", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue({
      id: "user-1",
      display_name: "Asha Rao",
      base_currency: "INR",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      financial_year_start_month: 4,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const { default: ProfileSettingsPage } =
      await import("@/app/app/settings/profile/page");

    render(await ProfileSettingsPage());

    expect(
      screen.getByRole("heading", { name: "Profile settings" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Asha Rao");
  });

  it("falls back to default values when no profile row exists yet", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: ProfileSettingsPage } =
      await import("@/app/app/settings/profile/page");

    render(await ProfileSettingsPage());

    expect(screen.getByLabelText("Base currency")).toHaveValue("INR");
    expect(screen.getByLabelText("Timezone")).toHaveValue("Asia/Kolkata");
  });

  it("links back to the app home", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: ProfileSettingsPage } =
      await import("@/app/app/settings/profile/page");

    render(await ProfileSettingsPage());

    expect(
      screen.getByRole("link", { name: /back to penra money os/i }),
    ).toHaveAttribute("href", "/app");
  });
});
