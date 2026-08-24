"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";
import { addWatchlistItemAction } from "@/lib/research/actions";
import { searchMarketInstrumentsAction } from "@/lib/market-data/actions";
import type { MarketInstrument } from "@/lib/market-data/mapping";

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Search-and-add UI for one watchlist — deliberately restricted to
 * `instrument_kind: "stock"` (never mutual funds), since watchlists /
 * company research track operating companies, not fund schemes (see
 * validate_..._instrument_is_stock() in the Phase 9 migration, which the
 * database enforces independently of this restriction). Adding a company
 * here only ever inserts a watchlist_items row — it never creates a
 * holding or investment activity.
 */
export function AddWatchlistItemPanel({
  watchlistId,
  existingInstrumentIds,
}: Readonly<{
  watchlistId: string;
  existingInstrumentIds: readonly string[];
}>) {
  const router = useRouter();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketInstrument[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setSearchPending(true);
      setSearchError(null);
      void searchMarketInstrumentsAction(query, "stock").then((result) => {
        setSearchPending(false);
        if (result.status === "error") {
          setSearchError(result.message);
          setResults([]);
          return;
        }
        setResults(result.results);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [trimmedQuery, query]);

  const visibleResults = trimmedQuery.length === 0 ? [] : results;

  async function handleAdd(instrument: MarketInstrument) {
    setAddingId(instrument.id);
    setAddError(null);
    const formData = new FormData();
    formData.set("watchlistId", watchlistId);
    formData.set("instrumentId", instrument.id);
    const result = await addWatchlistItemAction({ status: "idle" }, formData);
    setAddingId(null);
    if (result.status === "error") {
      setAddError(result.message);
      return;
    }
    setQuery("");
    setResults([]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={searchId}>Search stocks to add</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={searchId}
          className="pl-9"
          placeholder="e.g. HDFCBANK"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {searchPending ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Searching…
        </div>
      ) : null}
      {searchError ? <FormMessage message={searchError} tone="error" /> : null}
      {addError ? <FormMessage message={addError} tone="error" /> : null}

      {!searchPending &&
      trimmedQuery.length > 0 &&
      visibleResults.length === 0 &&
      !searchError ? (
        <p className="text-sm text-muted-foreground">No matches found.</p>
      ) : null}

      {visibleResults.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visibleResults.map((instrument) => {
            const alreadyAdded = existingInstrumentIds.includes(instrument.id);
            return (
              <li
                key={instrument.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {instrument.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {instrument.symbol ?? instrument.providerInstrumentId}
                    {instrument.exchange ? ` · ${instrument.exchange}` : ""}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={alreadyAdded}
                  isLoading={addingId === instrument.id}
                  onClick={() => void handleAdd(instrument)}
                >
                  {alreadyAdded ? "Added" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
