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
