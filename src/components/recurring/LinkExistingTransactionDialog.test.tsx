import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/recurring/actions", () => ({
  linkExistingTransactionAction: vi.fn(),
}));

import { LinkExistingTransactionDialog } from "@/components/recurring/LinkExistingTransactionDialog";
import { Decimal } from "@/lib/money/decimal";

const CANDIDATES = [
  {
    id: "txn-1",
    description: "Electricity board payment",
    occurredAt: "2026-08-10T10:00:00+05:30",
    amount: new Decimal(1500),
    currency: "INR",
    accountName: "HDFC Savings",
  },
  {
    id: "txn-2",
    description: "BESCOM bill",
    occurredAt: "2026-08-11T10:00:00+05:30",
    amount: new Decimal(1600),
    currency: "INR",
    accountName: "SBI Savings",
  },
];

describe("LinkExistingTransactionDialog", () => {
  it("shows an empty state when there are no compatible candidates", async () => {
    const user = userEvent.setup();
    render(
      <LinkExistingTransactionDialog occurrenceId="occ-1" candidates={[]} />,
    );

    await user.click(screen.getByRole("button", { name: "Link existing" }));

    expect(screen.getByText("No compatible transactions")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("lists every candidate transaction as a selectable option", async () => {
    const user = userEvent.setup();
    render(
      <LinkExistingTransactionDialog
        occurrenceId="occ-1"
        candidates={CANDIDATES}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Link existing" }));

    expect(
      screen.getByRole("option", { name: /Electricity board payment/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /BESCOM bill/ }),
    ).toBeInTheDocument();
  });

  it("disables the Link transaction button until a candidate is selected", async () => {
    const user = userEvent.setup();
    render(
      <LinkExistingTransactionDialog
        occurrenceId="occ-1"
        candidates={CANDIDATES}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Link existing" }));

    expect(
      screen.getByRole("button", { name: "Link transaction" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("option", { name: /Electricity board payment/ }),
    );

    expect(
      screen.getByRole("button", { name: "Link transaction" }),
    ).toBeEnabled();
  });

  it("marks the clicked candidate as selected, and only one at a time", async () => {
    const user = userEvent.setup();
    render(
      <LinkExistingTransactionDialog
        occurrenceId="occ-1"
        candidates={CANDIDATES}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Link existing" }));
    const first = screen.getByRole("option", {
      name: /Electricity board payment/,
    });
    const second = screen.getByRole("option", { name: /BESCOM bill/ });

    await user.click(first);
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveAttribute("aria-selected", "false");

    await user.click(second);
    expect(first).toHaveAttribute("aria-selected", "false");
    expect(second).toHaveAttribute("aria-selected", "true");
  });

  it("closes without submitting when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LinkExistingTransactionDialog
        occurrenceId="occ-1"
        candidates={CANDIDATES}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Link existing" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
