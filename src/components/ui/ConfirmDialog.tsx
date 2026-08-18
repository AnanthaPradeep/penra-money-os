"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "destructive" styles the confirm button as a warning action (e.g. reverse); use "primary" for a neutral confirmation. */
  tone?: "primary" | "destructive";
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
};

/**
 * The one confirmation-dialog implementation for the app — every
 * destructive or hard-to-undo action (archive an account, reverse a
 * transaction) should route through this rather than a bespoke `confirm()`
 * call or an inline toggle, so focus trapping, labelling, and the
 * disabled-while-submitting behaviour are never each reinvented.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  isConfirming = false,
}: Readonly<ConfirmDialogProps>) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isConfirming}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "primary"}
            onClick={() => {
              void handleConfirm();
            }}
            isLoading={isConfirming}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
