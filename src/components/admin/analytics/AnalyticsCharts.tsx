"use client";

// The ONLY module that imports Chart.js. It's loaded lazily by ChartFrame
// (next/dynamic, client-only) from the analytics page alone, so no other
// page - staff, admin or customer - ships the chart library. A source
// guard test (chart-scope.test.ts) keeps it that way.
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import type { ChartSpec } from "./chart-spec";

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Filler);

// Design tokens (globals.css): marks in the brand primary (validated: lightness,
// chroma and >=3:1 contrast against the white card surface), axis text in a
// text token, gridlines a hairline one step off the surface.
const MARK = "#a84e1c"; // --color-brand-700 / --color-primary
const WASH = "rgba(168, 78, 28, 0.1)";
const GRID = "#e2e8f0"; // --color-neutral-200
const TICK = "#475569"; // --color-neutral-600

function formatValue(spec: ChartSpec, v: number): string {
  return spec.unit === "kina" ? `K${v.toLocaleString("en-US")}` : v.toLocaleString("en-US");
}

export default function AnalyticsChart({ spec }: { spec: ChartSpec }) {
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const common: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 300 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false }, // one series per chart - the title names it
      tooltip: {
        callbacks: {
          title: (items) => (items[0] ? (spec.tooltipTitles?.[items[0].dataIndex] ?? String(items[0].label)) : ""),
          label: (ctx) => `${spec.seriesLabel}: ${formatValue(spec, Number(ctx.parsed.y))}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: GRID }, ticks: { color: TICK } },
      y: {
        beginAtZero: true,
        grid: { color: GRID, lineWidth: 1 },
        border: { display: false },
        ticks: {
          color: TICK,
          precision: spec.unit === "count" ? 0 : undefined,
          callback: (v) => formatValue(spec, Number(v)),
        },
      },
    },
  };

  const data = {
    labels: spec.labels,
    datasets: [
      spec.kind === "bar"
        ? {
            label: spec.seriesLabel,
            data: spec.values,
            backgroundColor: MARK,
            maxBarThickness: 24,
            borderRadius: 4,
            borderSkipped: "start" as const,
          }
        : {
            label: spec.seriesLabel,
            data: spec.values,
            borderColor: MARK,
            backgroundColor: WASH,
            fill: true,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: MARK,
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            tension: 0,
          },
    ],
  };

  return (
    <div className="relative h-56" role="img" aria-label={spec.ariaLabel}>
      {spec.kind === "bar" ? (
        <Bar data={data as never} options={common as ChartOptions<"bar">} />
      ) : (
        <Line data={data as never} options={common as ChartOptions<"line">} />
      )}
    </div>
  );
}
