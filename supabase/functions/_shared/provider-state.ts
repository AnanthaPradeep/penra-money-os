// Shared by every Edge Function under supabase/functions/ (filename-prefixed
// with an underscore so the Supabase CLI/platform never treats this
// directory as its own deployable function). Keeps
// market_data_provider_state's attempt/success/failure bookkeeping
// consistent across amfi-nav-refresh and stock-price-refresh rather than
// duplicating slightly-different read-then-write logic in each. Typed
// against the app's own generated Database type (bundled alongside this
// file at deploy time — see database.types.ts in this directory) so every
// .from()/.rpc() call here is checked against the real schema instead of
// resolving to an untyped/`any` boundary.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { Database } from "./database.types.ts";

type SupabaseServiceClient = SupabaseClient<Database>;

/** Records one refresh attempt for a provider — bumps consecutive_failures on failure, resets it to 0 and stamps last_success_at on success. Read-then-write (not a single atomic statement) since this runs from a service-role REST client, not SQL; a lost update here only affects a UI health counter, never financial data. */
export async function recordProviderAttempt(
  supabase: SupabaseServiceClient,
  provider: string,
  succeeded: boolean,
  failureErrorCode: string,
): Promise<void> {
  const now = new Date().toISOString();

  if (succeeded) {
    await supabase
      .from("market_data_provider_state")
      .update({
        last_attempt_at: now,
        last_success_at: now,
        consecutive_failures: 0,
        last_error_code: null,
      })
      .eq("provider", provider);
    return;
  }

  const { data: current } = await supabase
    .from("market_data_provider_state")
    .select("consecutive_failures")
    .eq("provider", provider)
    .maybeSingle();

  await supabase
    .from("market_data_provider_state")
    .update({
      last_attempt_at: now,
      last_error_code: failureErrorCode,
      consecutive_failures: (current?.consecutive_failures ?? 0) + 1,
    })
    .eq("provider", provider);
}
