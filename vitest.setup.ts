import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library's automatic post-test cleanup only registers itself
// when it detects a *global* afterEach (e.g. via `test.globals: true`).
// This project keeps globals off (explicit imports, matching Next's own
// Vitest guide), so cleanup is wired up explicitly here instead — without
// it, DOM nodes from one test leak into the next within the same file.
afterEach(() => {
  cleanup();
});
