import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { MarketDataProviderState } from "@/lib/market-data/mapping";
import { MARKET_DATA_PROVIDER_LABELS } from "@/lib/market-data/types";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** One provider's health card for /app/settings/market-data — never shows an API key, and never claims "live" for what is always end-of-day/delayed provider data. */
export function ProviderStatusCard({
  state,
}: Readonly<{ state: MarketDataProviderState }>) {
  const healthy = state.isConfigured && state.consecutiveFailures === 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-foreground">
            {MARKET_DATA_PROVIDER_LABELS[state.provider]}
          </p>
          {state.isConfigured ? (
            <StatusBadge status={healthy ? "active" : "failed"} />
          ) : (
            <StatusBadge status="paused" />
          )}
        </div>
        {!state.isConfigured ? (
          <p className="text-sm text-muted-foreground">
            Not configured in this environment.
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <dt>Last successful refresh</dt>
          <dd className="text-right text-foreground">
            {formatTimestamp(state.lastSuccessAt)}
          </dd>
          <dt>Last attempt</dt>
          <dd className="text-right text-foreground">
            {formatTimestamp(state.lastAttemptAt)}
          </dd>
          {state.consecutiveFailures > 0 ? (
            <>
              <dt>Consecutive failures</dt>
              <dd className="text-right text-negative">
                {state.consecutiveFailures}
              </dd>
            </>
          ) : null}
          {state.lastErrorCode ? (
            <>
              <dt>Last error</dt>
              <dd className="text-right text-foreground">
                {state.lastErrorCode}
              </dd>
            </>
          ) : null}
        </dl>
        {state.notes ? (
          <p className="text-xs text-muted-foreground">{state.notes}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
