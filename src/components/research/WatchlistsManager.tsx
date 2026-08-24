"use client";

import { Archive, PlusCircle, RotateCcw, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import { INITIAL_RESEARCH_ACTION_STATE } from "@/lib/research/action-state";
import {
  createWatchlistAction,
  setWatchlistArchivedAction,
} from "@/lib/research/actions";
import type { Watchlist } from "@/lib/research/mapping";
import { WATCHLIST_COLORS, WATCHLIST_ICONS } from "@/lib/research/types";

type WatchlistsManagerProps = {
  watchlists: Watchlist[];
  itemCounts: Record<string, number>;
};

export function WatchlistsManager({
  watchlists,
  itemCounts,
}: Readonly<WatchlistsManagerProps>) {
  const [createOpen, setCreateOpen] = useState(false);
  const active = watchlists.filter((w) => w.status === "active");
  const archived = watchlists.filter((w) => w.status === "archived");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusCircle aria-hidden="true" className="size-4" />
              New watchlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New watchlist</DialogTitle>
            </DialogHeader>
            <CreateWatchlistForm onDone={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {watchlists.length === 0 ? (
        <EmptyState
          icon={<Star aria-hidden="true" className="size-6" />}
          title="Create your first watchlist"
          description="Group companies you're researching by theme, sector, or conviction level. Adding a company here never creates a holding or trade."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusCircle aria-hidden="true" className="size-4" />
              New watchlist
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((watchlist) => (
              <li key={watchlist.id}>
                <WatchlistCard
                  watchlist={watchlist}
                  itemCount={itemCounts[watchlist.id] ?? 0}
                />
              </li>
            ))}
          </ul>
          {archived.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                Archived
              </p>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((watchlist) => (
                  <li key={watchlist.id}>
                    <WatchlistCard
                      watchlist={watchlist}
                      itemCount={itemCounts[watchlist.id] ?? 0}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function WatchlistCard({
  watchlist,
  itemCount,
}: Readonly<{ watchlist: Watchlist; itemCount: number }>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggleArchived() {
    setPending(true);
    const formData = new FormData();
    formData.set("watchlistId", watchlist.id);
    formData.set(
      "status",
      watchlist.status === "archived" ? "active" : "archived",
    );
    await setWatchlistArchivedAction({ status: "idle" }, formData);
    setPending(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/app/watchlists/${watchlist.id}`}
            className="min-w-0 truncate font-medium text-foreground hover:underline"
          >
            {watchlist.name}
          </Link>
          <Badge variant="neutral">
            {itemCount} {itemCount === 1 ? "company" : "companies"}
          </Badge>
        </div>
        {watchlist.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {watchlist.description}
          </p>
        ) : null}
        <div className="mt-1 flex items-center justify-between gap-2">
          <Link
            href={`/app/watchlists/${watchlist.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open
          </Link>
          {watchlist.status === "archived" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isLoading={pending}
              onClick={() => void toggleArchived()}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Restore
            </Button>
          ) : (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="sm">
                  <Archive aria-hidden="true" className="size-4" />
                  Archive
                </Button>
              }
              title={`Archive "${watchlist.name}"?`}
              description="Its companies, notes, and research history stay intact — you can restore it any time."
              confirmLabel="Archive watchlist"
              onConfirm={toggleArchived}
              isConfirming={pending}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateWatchlistForm({ onDone }: Readonly<{ onDone: () => void }>) {
  const [state, formAction] = useActionState(
    createWatchlistAction,
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
      <Field
        id="new-watchlist-name"
        name="name"
        label="Name"
        required
        placeholder="e.g. Compounders to watch"
        error={fieldError("name")}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-watchlist-description">
          Description (optional)
        </Label>
        <Textarea
          id="new-watchlist-description"
          name="description"
          rows={2}
          placeholder="What ties these companies together?"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          id="new-watchlist-color"
          name="color"
          label="Colour"
          defaultValue="slate"
          options={WATCHLIST_COLORS.map((color) => ({
            value: color,
            label: color,
          }))}
        />
        <Select
          id="new-watchlist-icon"
          name="icon"
          label="Icon"
          defaultValue="star"
          options={WATCHLIST_ICONS.map((icon) => ({
            value: icon,
            label: icon.replace(/-/g, " "),
          }))}
        />
      </div>
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Creating…">Create watchlist</SubmitButton>
    </form>
  );
}
