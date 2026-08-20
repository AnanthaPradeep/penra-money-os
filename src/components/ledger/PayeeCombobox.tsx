"use client";

import { Check, Plus, X } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";

import { Label } from "@/components/ui/Label";
import { inputStyles } from "@/components/ui/Input";
import { createPayeeAction } from "@/lib/payees/actions";
import { cn } from "@/lib/ui/cn";

export type PayeeOption = { id: string; name: string };

type PayeeComboboxProps = {
  payees: PayeeOption[];
  name: string;
  label: string;
  defaultPayee?: PayeeOption | undefined;
};

/**
 * A minimal search-or-create payee picker. Not a Radix component — this
 * app's dependency set (see Phase 4) has no popover/combobox primitive
 * installed, and one narrow custom listbox is a smaller footprint than a
 * new dependency for a single field. Selecting or creating a payee writes
 * its id into a hidden `name` input, which is what the transaction form
 * actually submits — the visible text input is display/search only.
 */
export function PayeeCombobox({
  payees,
  name,
  label,
  defaultPayee,
}: Readonly<PayeeComboboxProps>) {
  const [query, setQuery] = useState(defaultPayee?.name ?? "");
  const [selected, setSelected] = useState<PayeeOption | null>(
    defaultPayee ?? null,
  );
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const listboxId = useId();

  const trimmedQuery = query.trim();

  const matches = useMemo(() => {
    if (trimmedQuery.length === 0) {
      return payees.slice(0, 8);
    }
    const lower = trimmedQuery.toLowerCase();
    return payees
      .filter((payee) => payee.name.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [payees, trimmedQuery]);

  const exactMatch = payees.some(
    (payee) => payee.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );

  function selectPayee(payee: PayeeOption) {
    setSelected(payee);
    setQuery(payee.name);
    setOpen(false);
    setCreateError(null);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setOpen(false);
  }

  async function handleCreate() {
    if (trimmedQuery.length === 0 || creating) {
      return;
    }
    setCreating(true);
    setCreateError(null);

    const formData = new FormData();
    formData.set("name", trimmedQuery);
    const result = await createPayeeAction({ status: "idle" }, formData);

    setCreating(false);
    if (result.status === "success") {
      selectPayee(result.payee);
    } else if (result.status === "error") {
      setCreateError(result.message);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (matches[0]) {
        selectPayee(matches[0]);
      } else if (!exactMatch) {
        void handleCreate();
      }
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${name}-search`}>{label}</Label>
      <div className="relative">
        <input type="hidden" name={name} value={selected?.id ?? ""} />
        <input
          id={`${name}-search`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className={cn(inputStyles, "pr-9")}
          placeholder="Search or add a payee…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOpen(true);
            setCreateError(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Let a click on a listbox option register before closing.
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear payee"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-elevated py-1 shadow-md"
          >
            {matches.map((payee) => (
              <li key={payee.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.id === payee.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectPayee(payee)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted-surface"
                >
                  {selected?.id === payee.id ? (
                    <Check aria-hidden="true" className="size-4 shrink-0" />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                  {payee.name}
                </button>
              </li>
            ))}
            {trimmedQuery.length > 0 && !exactMatch ? (
              <li>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void handleCreate()}
                  disabled={creating}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-muted-surface disabled:opacity-50"
                >
                  <Plus aria-hidden="true" className="size-4 shrink-0" />
                  {creating ? "Adding…" : `Add "${trimmedQuery}"`}
                </button>
              </li>
            ) : null}
            {matches.length === 0 && trimmedQuery.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Start typing to search or add a payee
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      {createError ? (
        <p role="alert" className="text-sm text-negative">
          {createError}
        </p>
      ) : null}
    </div>
  );
}
