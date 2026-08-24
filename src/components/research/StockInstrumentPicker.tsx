"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";
import { searchMarketInstrumentsAction } from "@/lib/market-data/actions";
import type { MarketInstrument } from "@/lib/market-data/mapping";

const SEARCH_DEBOUNCE_MS = 350;

type StockInstrumentPickerProps = {
  /** The <input type="hidden"> field name this picker's chosen instrument id is submitted under — lets it drop into any existing <form> (idea creation, comparison) unchanged. */
  name: string;
  label: string;
  required?: boolean;
  initial?: MarketInstrument | null;
  /** Notified whenever the selection changes (picked or cleared) — optional, for callers (e.g. the comparison picker) that need to track the choice client-side rather than only reading it back from form submission. */
  onChange?: (instrument: MarketInstrument | null) => void;
};

/** A single-stock search-and-select control, backed by public.search_market_instruments filtered to instrument_kind="stock". Shared between the investment-idea creation form and the company-comparison picker so the search UX (and its stock-only restriction) is defined exactly once. */
export function StockInstrumentPicker({
  name,
  label,
  required,
  initial = null,
  onChange,
}: Readonly<StockInstrumentPickerProps>) {
  const searchId = useId();
  const [selected, setSelected] = useState<MarketInstrument | null>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketInstrument[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{label}</Label>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated p-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {selected.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {selected.symbol ?? selected.providerInstrumentId}
              {selected.exchange ? ` · ${selected.exchange}` : ""}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(null);
              onChange?.(null);
            }}
          >
            Change
          </Button>
        </div>
        <input type="hidden" name={name} value={selected.id} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={searchId}>{label}</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={searchId}
          className="pl-9"
          placeholder="Search a stock by name or symbol"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {searchPending ? (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Searching…
        </div>
      ) : null}
      {searchError ? <FormMessage message={searchError} tone="error" /> : null}
      {visibleResults.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {visibleResults.map((instrument) => (
            <li key={instrument.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(instrument);
                  setQuery("");
                  setResults([]);
                  onChange?.(instrument);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-elevated p-3 text-left transition-colors hover:border-input-border"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {instrument.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {instrument.symbol ?? instrument.providerInstrumentId}
                    {instrument.exchange ? ` · ${instrument.exchange}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input type="hidden" name={name} value="" required={required} />
    </div>
  );
}
