import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("starts closed, requiring a deliberate trigger click", () => {
    render(
      <ConfirmDialog
        trigger={<Button>Delete account</Button>}
        title="Delete this?"
        description="This cannot be undone."
        confirmLabel="Yes, delete"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on trigger click, with an accessible title and description", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Delete account</Button>}
        title="Delete this?"
        description="This cannot be undone."
        confirmLabel="Yes, delete"
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete account" }));

    const dialog = screen.getByRole("dialog", { name: "Delete this?" });
    expect(dialog).toHaveTextContent("This cannot be undone.");
  });

  it("calls onConfirm only after the confirm button is clicked, never on open", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Delete account</Button>}
        title="Delete this?"
        description="This cannot be undone."
        confirmLabel="Yes, delete"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes without confirming when Cancel is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Delete account</Button>}
        title="Delete this?"
        description="This cannot be undone."
        confirmLabel="Yes, delete"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Delete account</Button>}
        title="Delete this?"
        description="This cannot be undone."
        confirmLabel="Yes, delete"
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the destructive button styling only when tone is destructive", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Delete account</Button>}
        title="Delete this?"
        description="This cannot be undone."
        confirmLabel="Yes, delete"
        tone="destructive"
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete account" }));

    expect(screen.getByRole("button", { name: "Yes, delete" })).toHaveClass(
      "bg-destructive",
    );
  });
});
