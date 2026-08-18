import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { createInstitutionAction } from "@/lib/institutions/actions";

const createInstitutionActionMock = vi.fn<typeof createInstitutionAction>();
vi.mock("@/lib/institutions/actions", () => ({
  createInstitutionAction: (
    ...args: Parameters<typeof createInstitutionAction>
  ) => createInstitutionActionMock(...args),
}));

const routerRefreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

import { AddInstitutionForm } from "@/components/institutions/AddInstitutionForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddInstitutionForm", () => {
  it("starts collapsed, showing only a disclosure control", () => {
    render(<AddInstitutionForm />);

    expect(
      screen.getByRole("button", { name: "+ Add a new institution" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Institution name")).not.toBeInTheDocument();
  });

  it("reveals the form fields when opened", async () => {
    const user = userEvent.setup();
    render(<AddInstitutionForm />);

    await user.click(
      screen.getByRole("button", { name: "+ Add a new institution" }),
    );

    expect(screen.getByLabelText("Institution name")).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
  });

  it("collapses again when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<AddInstitutionForm />);

    await user.click(
      screen.getByRole("button", { name: "+ Add a new institution" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Institution name")).not.toBeInTheDocument();
  });

  it("refreshes the router only after a confirmed successful create", async () => {
    createInstitutionActionMock.mockResolvedValue({
      status: "success",
      message: "Institution created.",
      institution: { id: "inst-1", name: "HDFC Bank" },
    });

    const user = userEvent.setup();
    render(<AddInstitutionForm />);

    await user.click(
      screen.getByRole("button", { name: "+ Add a new institution" }),
    );
    await user.click(screen.getByRole("button", { name: "Add institution" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Institution created.",
    );
    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows a field error without refreshing the router", async () => {
    createInstitutionActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { name: "Please enter an institution name." },
    });

    const user = userEvent.setup();
    render(<AddInstitutionForm />);

    await user.click(
      screen.getByRole("button", { name: "+ Add a new institution" }),
    );
    await user.click(screen.getByRole("button", { name: "Add institution" }));

    expect(
      await screen.findByText("Please enter an institution name."),
    ).toBeInTheDocument();
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });
});
