"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import { INITIAL_RESEARCH_ACTION_STATE } from "@/lib/research/action-state";
import { updateWatchlistAction } from "@/lib/research/actions";
import type { Watchlist } from "@/lib/research/mapping";
import { WATCHLIST_COLORS, WATCHLIST_ICONS } from "@/lib/research/types";

export function EditWatchlistDialog({
  watchlist,
}: Readonly<{ watchlist: Watchlist }>) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit watchlist</DialogTitle>
        </DialogHeader>
        <EditWatchlistForm
          watchlist={watchlist}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditWatchlistForm({
  watchlist,
  onDone,
}: Readonly<{ watchlist: Watchlist; onDone: () => void }>) {
  const [state, formAction] = useActionState(
    updateWatchlistAction,
    INITIAL_RESEARCH_ACTION_STATE,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="watchlistId" value={watchlist.id} />
      <Field
        id="edit-watchlist-name"
        name="name"
        label="Name"
        required
        defaultValue={watchlist.name}
        error={fieldError("name")}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-watchlist-description">
          Description (optional)
        </Label>
        <Textarea
          id="edit-watchlist-description"
          name="description"
          rows={2}
          defaultValue={watchlist.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          id="edit-watchlist-color"
          name="color"
          label="Colour"
          defaultValue={watchlist.color}
          options={WATCHLIST_COLORS.map((color) => ({
            value: color,
            label: color,
          }))}
        />
        <Select
          id="edit-watchlist-icon"
          name="icon"
          label="Icon"
          defaultValue={watchlist.icon}
          options={WATCHLIST_ICONS.map((icon) => ({
            value: icon,
            label: icon.replace(/-/g, " "),
          }))}
        />
      </div>
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
