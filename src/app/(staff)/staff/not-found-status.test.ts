import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the real-404 fix. A loading.tsx is a Suspense boundary: once its
// fallback streams, the response is committed as HTTP 200, so notFound() in
// a page below it can no longer set a 404 status. The queue, review and
// customer-history pages rely on notFound() for unknown queues/applications,
// so no loading.tsx may sit above them - the dashboard's is scoped to the
// (overview) route group. Verified against `next start`: unknown URLs 404.
const staffDir = join(process.cwd(), "src", "app", "(staff)", "staff");

function loadingFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return loadingFiles(path);
    return /^loading\.(tsx|ts|jsx|js)$/.test(name) ? [path] : [];
  });
}

describe("staff routes can return a real 404", () => {
  it("has no loading boundary above the pages that call notFound()", () => {
    const found = loadingFiles(staffDir).map((p) => p.slice(staffDir.length + 1).replaceAll("\\", "/"));
    expect(found).toEqual(["(overview)/loading.tsx"]);
  });

  it("keeps the dashboard's loading state", () => {
    expect(existsSync(join(staffDir, "(overview)", "page.tsx"))).toBe(true);
    expect(existsSync(join(staffDir, "(overview)", "loading.tsx"))).toBe(true);
  });
});
