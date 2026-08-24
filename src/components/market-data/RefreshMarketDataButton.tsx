"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { runMarketDataRefreshSelfAction } from "@/lib/market-data/actions";

/** Self-scoped, cooldown-limited manual refresh — see public.run_market_data_refresh_self. The cooldown is entirely server-enforced; this component only reflects what the server reports back after a click, never guesses it in advance. */
export function RefreshMarketDataButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  function startCountdown(seconds: number) {
    setCooldownSeconds(seconds);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      setCooldownSeconds((current) => {
        if (current <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function handleClick() {
    setPending(true);
    setMessage(null);
    const result = await runMarketDataRefreshSelfAction();
    setPending(false);

    if (result.status === "error") {
      setMessage(result.message);
      return;
    }

    if (result.queued) {
      setMessage(
        result.instrumentsRequested > 0
          ? `Refresh queued for ${result.instrumentsRequested} linked ${result.instrumentsRequested === 1 ? "holding" : "holdings"}. Prices update in the background — check back shortly.`
          : "No linked holdings to refresh yet.",
      );
      startCountdown(result.retryAfterSeconds);
      router.refresh();
    } else {
      setMessage(
        `You've refreshed recently — try again in ${result.retryAfterSeconds}s.`,
      );
      startCountdown(result.retryAfterSeconds);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        isLoading={pending}
        disabled={cooldownSeconds > 0}
        onClick={() => void handleClick()}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        {cooldownSeconds > 0
          ? `Refresh available in ${cooldownSeconds}s`
          : "Refresh my linked holdings"}
      </Button>
      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
