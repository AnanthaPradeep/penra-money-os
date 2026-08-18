import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { createAccountAction } from "@/lib/accounts/actions";
import type { createInstitutionAction } from "@/lib/institutions/actions";

const createAccountActionMock = vi.fn<typeof createAccountAction>();
vi.mock("@/lib/accounts/actions", () => ({
  createAccountAction: (...args: Parameters<typeof createAccountAction>) =>
    createAccountActionMock(...args),
}));

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

import { AccountForm } from "@/components/accounts/AccountForm";
import type { Institution } from "@/lib/institutions/mapping";

const SAMPLE_INSTITUTIONS: Institution[] = [
  {
    id: "inst-1",
    name: "HDFC Bank",
    institutionType: "bank",
    website: null,
    notes: null,
    isArchived: false,
  },
];

describe("AccountForm", () => {
  it("renders the core account fields", () => {
    render(<AccountForm institutions={SAMPLE_INSTITUTIONS} />);

    expect(screen.getByLabelText("Account name")).toBeInTheDocument();
    expect(screen.getByLabelText("Account type")).toBeInTheDocument();
    expect(screen.getByLabelText("Institution")).toBeInTheDocument();
    expect(screen.getByLabelText("Opening balance")).toBeInTheDocument();
  });

  it("lists the given institutions in the institution select", () => {
    render(<AccountForm institutions={SAMPLE_INSTITUTIONS} />);

    expect(
      screen.getByRole("option", { name: "HDFC Bank" }),
    ).toBeInTheDocument();
  });

  it("hides the credit limit field until a credit card type is chosen", async () => {
    const user = userEvent.setup();
    render(<AccountForm institutions={[]} />);

    expect(screen.queryByLabelText("Credit limit")).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Account type"),
      "Credit card",
    );

    expect(screen.getByLabelText("Credit limit")).toBeInTheDocument();
  });

  it("shows field errors returned by the Server Action", async () => {
    createAccountActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { name: "Please enter an account name." },
    });

    const user = userEvent.setup();
    render(<AccountForm institutions={[]} />);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("Please enter an account name."),
    ).toBeInTheDocument();
  });

  it("shows a safe error message, never a raw database error", async () => {
    createAccountActionMock.mockResolvedValue({
      status: "error",
      message: "We couldn't create that account. Please try again.",
    });

    const user = userEvent.setup();
    render(<AccountForm institutions={[]} />);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "We couldn't create that account. Please try again.",
    );
    expect(alert.textContent).not.toMatch(/postgres|sql|constraint/i);
  });

  it("renders the collapsed add-institution control by default", () => {
    render(<AccountForm institutions={[]} />);

    expect(
      screen.getByRole("button", { name: "+ Add a new institution" }),
    ).toBeInTheDocument();
  });
});
