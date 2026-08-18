// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
// for every test file, per the setupFiles entry in vitest.config.ts.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `test.globals` is intentionally off (explicit imports throughout), so
// Testing Library's own auto-cleanup detection (which looks for a global
// `afterEach`) never registers. Unmount rendered components after each
// test explicitly instead, so DOM state never leaks between test cases.
afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia at all — next-themes (system-theme
// detection) and any future `prefers-*` media query check call it
// unconditionally on mount. A safe, inert stub (matches nothing, no-op
// listeners) is enough for every test that just needs the call to not
// throw; a test that specifically cares about a particular media query
// result should override `window.matchMedia` itself.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
