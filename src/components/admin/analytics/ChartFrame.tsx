"use client";

import dynamic from "next/dynamic";
import type { ChartSpec } from "./chart-spec";

// Loads the Chart.js module only on the analytics page, only in the
// browser (a canvas has nothing to render on the server). Same-size
// placeholder while it loads, so the layout doesn't jump.
const AnalyticsChart = dynamic(() => import("./AnalyticsCharts"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-lg bg-neutral-100" aria-hidden="true" />,
});

export function ChartFrame({ spec }: { spec: ChartSpec }) {
  return <AnalyticsChart spec={spec} />;
}
