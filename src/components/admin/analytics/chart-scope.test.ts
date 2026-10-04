import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Chart.js stays scoped to the analytics page: only AnalyticsCharts.tsx may
// import it, only ChartFrame.tsx may load that (lazily, via next/dynamic),
// and only the analytics route uses ChartFrame. A static import anywhere
// else would put the chart library in that page's bundle.
const src = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const rel = (p: string) => relative(src, p).replaceAll("\\", "/");
const importers = (pattern: RegExp) => files(src).filter((f) => pattern.test(readFileSync(f, "utf8"))).map(rel);

describe("Chart.js is route-scoped to /admin/analytics", () => {
  it("is imported by one module only", () => {
    expect(importers(/from ["'](chart\.js|react-chartjs-2)["']/)).toEqual(["components/admin/analytics/AnalyticsCharts.tsx"]);
  });

  it("is loaded lazily, by the chart frame only", () => {
    expect(importers(/(from|import\()\s*["'][^"']*AnalyticsCharts["']/)).toEqual(["components/admin/analytics/ChartFrame.tsx"]);
    expect(readFileSync(join(src, "components/admin/analytics/ChartFrame.tsx"), "utf8")).toMatch(/dynamic\(\(\) => import\("\.\/AnalyticsCharts"\)/);
  });

  it("reaches pages only through the analytics route", () => {
    const cardUsers = importers(/from ["']@\/components\/admin\/analytics\/ChartCard["']/);
    expect(cardUsers).toEqual(["app/(admin)/admin/analytics/page.tsx"]);
    expect(importers(/from ["'][^"']*ChartFrame["']/)).toEqual(["components/admin/analytics/ChartCard.tsx"]);
  });
});
