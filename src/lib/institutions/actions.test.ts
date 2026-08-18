// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_INSTITUTION_ACTION_STATE } from "@/lib/institutions/action-state";
import type { TablesInsert } from "@/types/database.types";

vi.mock("server-only", () => ({}));

const getAuthenticatedUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const singleMock = vi.fn();
const selectMock = vi.fn(() => ({ single: singleMock }));
const insertMock = vi.fn((_payload: TablesInsert<"institutions">) => ({
  select: selectMock,
}));
const fromMock = vi.fn(() => ({ insert: insertMock }));
const mockSupabaseClient = { from: fromMock };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
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

const VALID_FIELDS = {
  name: "HDFC Bank",
  institutionType: "bank",
};

beforeEach(() => {
  vi.clearAllMocks();
  singleMock.mockResolvedValue({
    data: { id: "inst-1", name: "HDFC Bank" },
    error: null,
  });
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "a@example.com",
  });
});

describe("createInstitutionAction", () => {
  it("creates an institution scoped to the authenticated user's id", async () => {
    const { createInstitutionAction } =
      await import("@/lib/institutions/actions");

    const result = await createInstitutionAction(
      INITIAL_INSTITUTION_ACTION_STATE,
      formDataOf(VALID_FIELDS),
    );

    expect(result.status).toBe("success");
    expect(fromMock).toHaveBeenCalledWith("institutions");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", name: "HDFC Bank" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/app/accounts/new");
  });

  it("never trusts a submitted user id", async () => {
    const { createInstitutionAction } =
      await import("@/lib/institutions/actions");

    await createInstitutionAction(
      INITIAL_INSTITUTION_ACTION_STATE,
      formDataOf({ ...VALID_FIELDS, userId: "attacker-supplied-id" }),
    );

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1" }),
    );
  });

  it("returns an error and skips the database when the user is not authenticated", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { createInstitutionAction } =
      await import("@/lib/institutions/actions");

    const result = await createInstitutionAction(
      INITIAL_INSTITUTION_ACTION_STATE,
      formDataOf(VALID_FIELDS),
    );

    expect(result.status).toBe("error");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns field errors and skips the database for invalid input", async () => {
    const { createInstitutionAction } =
      await import("@/lib/institutions/actions");

    const result = await createInstitutionAction(
      INITIAL_INSTITUTION_ACTION_STATE,
      formDataOf({ ...VALID_FIELDS, name: "" }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.fieldErrors?.name).toBeDefined();
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects a javascript: website URL", async () => {
    const { createInstitutionAction } =
      await import("@/lib/institutions/actions");

    const result = await createInstitutionAction(
      INITIAL_INSTITUTION_ACTION_STATE,
      formDataOf({ ...VALID_FIELDS, website: "javascript:alert(1)" }),
    );

    expect(result.status).toBe("error");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns a safe message when the database insert fails", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "row-level security policy violation" },
    });
    const { createInstitutionAction } =
      await import("@/lib/institutions/actions");

    const result = await createInstitutionAction(
      INITIAL_INSTITUTION_ACTION_STATE,
      formDataOf(VALID_FIELDS),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).not.toContain("row-level security");
      expect(result.message).not.toContain("42501");
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
