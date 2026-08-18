import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * True only after the client has hydrated — false during SSR and on the
 * very first client render. Needed wherever rendering must differ between
 * server and client (e.g. next-themes' resolved theme, which the server
 * cannot know in advance). Implemented via useSyncExternalStore rather than
 * `useEffect(() => setMounted(true), [])`, since that pattern calls
 * setState synchronously inside an effect — this project treats that as a
 * lint error (see .eslintrc) because it risks cascading renders; a
 * differing get-snapshot-on-server-vs-client is exactly what
 * useSyncExternalStore exists for.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
