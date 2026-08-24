"use client";

import { Link2, Link2Off, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";
import type { InvestmentAsset } from "@/lib/investments/mapping";
import {
  linkMarketInstrumentAction,
  searchMarketInstrumentsAction,
  unlinkMarketInstrumentAction,
} from "@/lib/market-data/actions";
import type { MarketInstrument } from "@/lib/market-data/mapping";
import { MARKET_DATA_PROVIDER_LABELS } from "@/lib/market-data/types";

const SEARCH_DEBOUNCE_MS = 350;

type MarketInstrumentLinkPanelProps = {
  asset: InvestmentAsset;
  linkedInstrument: MarketInstrument | null;
};

/**
 * AMFI/stock scheme search-and-link UI for one investment asset — see
 * public.search_market_instruments and
 * public.link_investment_asset_to_market_instrument. Every link (first-time
 * or remap) goes through an explicit confirmation dialog naming the exact
 * scheme/AMC before it's saved; nothing auto-links from a fuzzy name match.
 * Renders nothing for PPF/FD/RD/other-investment assets — those have no
 * market-data concept at all.
 */
export function MarketInstrumentLinkPanel({
  asset,
  linkedInstrument,
}: Readonly<MarketInstrumentLinkPanelProps>) {
  const router = useRouter();
  const searchId = useId();
  const [searching, setSearching] = useState(linkedInstrument === null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketInstrument[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const instrumentKind = asset.assetKind === "stock" ? "stock" : "mutual_fund";

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!searching || trimmedQuery.length === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setSearchPending(true);
      setSearchError(null);
      void searchMarketInstrumentsAction(query, instrumentKind).then(
        (result) => {
          setSearchPending(false);
          if (result.status === "error") {
            setSearchError(result.message);
            setResults([]);
            return;
          }
          setResults(result.results);
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [trimmedQuery, query, searching, instrumentKind]);

  const visibleResults = trimmedQuery.length === 0 ? [] : results;

  async function handleLink(
    instrument: MarketInstrument,
    confirmRemap: boolean,
  ) {
    setLinkPending(true);
    setLinkError(null);
    const formData = new FormData();
    formData.set("assetId", asset.id);
    formData.set("marketInstrumentId", instrument.id);
    formData.set("confirmRemap", confirmRemap ? "true" : "false");
    const result = await linkMarketInstrumentAction(
      { status: "idle" },
      formData,
    );
    setLinkPending(false);
    if (result.status === "error") {
      setLinkError(result.message);
      return;
    }
    setSearching(false);
    router.refresh();
  }

  async function handleUnlink() {
    setLinkPending(true);
    setLinkError(null);
    const formData = new FormData();
    formData.set("assetId", asset.id);
    const result = await unlinkMarketInstrumentAction(
      { status: "idle" },
      formData,
    );
    setLinkPending(false);
    if (result.status === "error") {
      setLinkError(result.message);
      return;
    }
    setSearching(true);
    router.refresh();
  }

  if (asset.assetKind !== "stock" && asset.assetKind !== "mutual_fund") {
    return null;
  }

  if (!searching && linkedInstrument) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-elevated p-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Link2 aria-hidden="true" className="size-4 shrink-0" />
              {linkedInstrument.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {MARKET_DATA_PROVIDER_LABELS[linkedInstrument.provider]}
              {linkedInstrument.isin ? ` · ${linkedInstrument.isin}` : ""}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSearching(true)}
          >
            Change link
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isLoading={linkPending}
            onClick={() => void handleUnlink()}
          >
            <Link2Off aria-hidden="true" className="size-4" />
            Unlink
          </Button>
        </div>
        {linkError ? <FormMessage message={linkError} tone="error" /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={searchId}>
        {asset.assetKind === "mutual_fund"
          ? "Search AMFI schemes by name, code, or ISIN"
          : "Search stock symbols"}
      </Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={searchId}
          className="pl-9"
          placeholder={
            asset.assetKind === "mutual_fund"
              ? "e.g. HDFC Flexi Cap Fund"
              : "e.g. HDFCBANK"
          }
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
      {linkError ? <FormMessage message={linkError} tone="error" /> : null}

      {!searchPending &&
      trimmedQuery.length > 0 &&
      visibleResults.length === 0 &&
      !searchError ? (
        <p className="text-sm text-muted-foreground">No matches found.</p>
      ) : null}

      {visibleResults.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visibleResults.map((instrument) => (
            <li
              key={instrument.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {instrument.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {MARKET_DATA_PROVIDER_LABELS[instrument.provider]}
                  {instrument.exchange ? ` · ${instrument.exchange}` : ""}
                  {instrument.isin ? ` · ${instrument.isin}` : ""}
                </span>
              </div>
              <ConfirmDialog
                trigger={
                  <Button type="button" size="sm" variant="outline">
                    Link
                  </Button>
                }
                title={
                  linkedInstrument
                    ? "Replace the existing market data link?"
                    : "Link this investment to market data?"
                }
                description={
                  linkedInstrument ? (
                    <>
                      This replaces the current link to{" "}
                      <strong>{linkedInstrument.name}</strong> with{" "}
                      <strong>{instrument.name}</strong>. Future automated
                      prices will come from the new scheme/symbol instead.
                    </>
                  ) : (
                    <>
                      <strong>{asset.displayName}</strong> will use automated
                      prices from <strong>{instrument.name}</strong> (
                      {MARKET_DATA_PROVIDER_LABELS[instrument.provider]}) going
                      forward, falling back to a manual valuation or cost basis
                      if a price is ever missing.
                    </>
                  )
                }
                confirmLabel={linkedInstrument ? "Replace link" : "Link"}
                isConfirming={linkPending}
                onConfirm={() =>
                  handleLink(instrument, linkedInstrument !== null)
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {linkedInstrument ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setSearching(false)}
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
