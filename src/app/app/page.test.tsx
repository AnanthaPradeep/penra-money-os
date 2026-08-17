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

vi.mock("@/lib/auth/actions", () => ({
  logOutAction: vi.fn(),
}));

describe("AppHomePage (protected app shell)", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { default: AppHomePage } = await import("@/app/app/page");

    await expect(AppHomePage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/login?next=/app");
  });

  it("shows the product name, a welcome message with the profile display name, and account state", async () => {
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
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "PENRA Money OS" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Welcome back, Asha Rao.")).toBeInTheDocument();
    expect(screen.getByText("asha@example.com")).toBeInTheDocument();
    expect(screen.getByText("Authenticated")).toBeInTheDocument();
  });

  it("falls back to a generic welcome when no display name is set", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.getByText("Welcome back.")).toBeInTheDocument();
  });

  it("links to profile settings and includes a logout control", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(
      screen.getByRole("link", { name: "Profile settings" }),
    ).toHaveAttribute("href", "/app/settings/profile");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("states that financial modules begin in later phases", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.getByText(/financial modules/i)).toBeInTheDocument();
    expect(screen.getByText(/begin in later phases/i)).toBeInTheDocument();
  });

  it("never displays the user's full UUID", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(document.body.textContent).not.toContain(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("contains no fake balances, transactions, or financial figures", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    getProfileForUserMock.mockResolvedValue(null);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/₹\s*[\d,]+/);
    expect(text).not.toMatch(/\$\s*[\d,]+/);
    expect(text.toLowerCase()).not.toMatch(/balance:\s*[\d₹$]/);
  });
});
