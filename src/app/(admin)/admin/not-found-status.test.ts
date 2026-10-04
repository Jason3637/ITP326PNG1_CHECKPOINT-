import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Same guard as the staff area (see (staff)/staff/not-found-status.test.ts):
// no loading.tsx may sit above a page that calls notFound(), or the 404
// status is lost. The dashboard's is scoped to the (overview) route group.
const adminDir = join(process.cwd(), "src", "app", "(admin)", "admin");

function loadingFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return loadingFiles(path);
    return /^loading\.(tsx|ts|jsx|js)$/.test(name) ? [path] : [];
  });
}

describe("admin routes can return a real 404", () => {
  it("has no loading boundary above the pages that call notFound()", () => {
    const found = loadingFiles(adminDir).map((p) => p.slice(adminDir.length + 1).replaceAll("\\", "/"));
    expect(found).toEqual(["(overview)/loading.tsx"]);
  });

  it("keeps the dashboard's loading state", () => {
    expect(existsSync(join(adminDir, "(overview)", "page.tsx"))).toBe(true);
    expect(existsSync(join(adminDir, "(overview)", "loading.tsx"))).toBe(true);
  });
});
