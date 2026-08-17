// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_PROFILE_ACTION_STATE } from "@/lib/profile/action-state";

vi.mock("server-only", () => ({}));

const getAuthenticatedUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

type ProfileUpdatePayload = {
  display_name: string;
  base_currency: string;
  locale: string;
  timezone: string;
  financial_year_start_month: number;
};

const eqMock = vi.fn();
const updateMock = vi.fn((_payload: ProfileUpdatePayload) => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));
const mockSupabaseClient = { from: fromMock };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => mockSupabaseClient),
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

function formDataOf(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const VALID_PROFILE_FIELDS = {
  displayName: "Asha Rao",
  baseCurrency: "INR",
  locale: "en-IN",
  timezone: "Asia/Kolkata",
  financialYearStartMonth: "4",
};

beforeEach(() => {
  vi.clearAllMocks();
  eqMock.mockResolvedValue({ error: null });
});

describe("updateProfileAction", () => {
  it("updates only the current user's row, using the authenticated user's ID", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-123",
      email: "asha@example.com",
    });
    const { updateProfileAction } = await import("@/lib/profile/actions");

    const result = await updateProfileAction(
      INITIAL_PROFILE_ACTION_STATE,
      formDataOf(VALID_PROFILE_FIELDS),
    );

    expect(result.status).toBe("success");
    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(eqMock).toHaveBeenCalledWith("id", "user-123");
    expect(revalidatePathMock).toHaveBeenCalledWith("/app/settings/profile");
  });

  it("never trusts a submitted user ID — uses the authenticated ID even when the form supplies a different one", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "real-authenticated-user",
      email: "asha@example.com",
    });
    const { updateProfileAction } = await import("@/lib/profile/actions");

    await updateProfileAction(
      INITIAL_PROFILE_ACTION_STATE,
      formDataOf({
        ...VALID_PROFILE_FIELDS,
        id: "attacker-supplied-id",
        userId: "attacker-supplied-id",
      }),
    );

    expect(eqMock).toHaveBeenCalledWith("id", "real-authenticated-user");
    expect(eqMock).not.toHaveBeenCalledWith("id", "attacker-supplied-id");
  });

  it("never includes id or created_at in the update payload", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-123",
      email: "asha@example.com",
    });
    const { updateProfileAction } = await import("@/lib/profile/actions");

    await updateProfileAction(
      INITIAL_PROFILE_ACTION_STATE,
      formDataOf(VALID_PROFILE_FIELDS),
    );

    const payload = updateMock.mock.calls[0]![0];
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("created_at");
    expect(payload).not.toHaveProperty("updated_at");
    expect(Object.keys(payload).sort()).toEqual(
      [
        "base_currency",
        "display_name",
        "financial_year_start_month",
        "locale",
        "timezone",
      ].sort(),
    );
  });

  it("returns a safe message and does not query the database when the user is not authenticated", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { updateProfileAction } = await import("@/lib/profile/actions");

    const result = await updateProfileAction(
      INITIAL_PROFILE_ACTION_STATE,
      formDataOf(VALID_PROFILE_FIELDS),
    );

    expect(result.status).toBe("error");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns field validation errors and never queries the database for invalid input", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-123",
      email: "asha@example.com",
    });
    const { updateProfileAction } = await import("@/lib/profile/actions");

    const result = await updateProfileAction(
      INITIAL_PROFILE_ACTION_STATE,
      formDataOf({ ...VALID_PROFILE_FIELDS, displayName: "" }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.fieldErrors?.displayName).toBeDefined();
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid financial-year start month", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-123",
      email: "asha@example.com",
    });
    const { updateProfileAction } = await import("@/lib/profile/actions");

    const result = await updateProfileAction(
      INITIAL_PROFILE_ACTION_STATE,
      formDataOf({ ...VALID_PROFILE_FIELDS, financialYearStartMonth: "13" }),
    );

    expect(result.status).toBe("error");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns a safe message when the database update fails, never a raw Postgrest error", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-123",
      email: "asha@example.com",
    });
    eqMock.mockResolvedValue({
      error: {
        code: "42501",
        message:
          'new row violates row-level security policy for table "profiles"',
      },
    });
    const { updateProfileAction } = await import("@/lib/profile/actions");

    const result = await updateProfileAction(
      INITIAL_PROFILE_ACTION_STATE,
      formDataOf(VALID_PROFILE_FIELDS),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).not.toContain("row-level security");
      expect(result.message).not.toContain("42501");
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
