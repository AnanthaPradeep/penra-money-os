import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import type { getProfileForUser } from "@/lib/profile/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const getProfileForUserMock = vi.fn<typeof getProfileForUser>();
vi.mock("@/lib/profile/queries", () => ({
  getProfileForUser: (...args: Parameters<typeof getProfileForUser>) =>
    getProfileForUserMock(...args),
}));

const redirectMock = vi.fn((url: string): never => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;push;${url};307;`,
  });
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

    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  it("shows the account email as read-only", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: ProfileSettingsPage } =
      await import("@/app/app/settings/profile/page");

    render(await ProfileSettingsPage());

    const emailField = screen.getByLabelText("Email");
    expect(emailField).toHaveValue("asha@example.com");
    expect(emailField).toBeDisabled();
  });

  it("includes a theme preference control", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: ProfileSettingsPage } =
      await import("@/app/app/settings/profile/page");

    render(await ProfileSettingsPage());

    expect(
      screen.getByRole("radiogroup", { name: "Theme" }),
    ).toBeInTheDocument();
  });

  it("never displays the user's full UUID", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: ProfileSettingsPage } =
      await import("@/app/app/settings/profile/page");

    render(await ProfileSettingsPage());

    expect(document.body.textContent).not.toContain(
      "11111111-1111-1111-1111-111111111111",
    );
  });
});
