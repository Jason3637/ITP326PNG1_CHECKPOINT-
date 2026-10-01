import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Per the installed Next.js version's own testing guide
// (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md) —
// Vitest does not support rendering async Server Components at all, so
// this project's page.tsx files (all async) are intentionally not unit
// tested here; coverage targets the pure logic and sync/client components
// those pages compose.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
