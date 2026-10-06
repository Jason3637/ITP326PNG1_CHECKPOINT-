// What the server page hands the lazily loaded chart: plain, serialisable
// numbers that are already the backend's figures.
export interface ChartSpec {
  kind: "bar" | "line";
  unit: "count" | "kina";
  seriesLabel: string;
  ariaLabel: string;
  labels: string[]; // axis labels
  tooltipTitles?: string[]; // fuller labels for the tooltip, same order
  values: number[];
}

// The plot area's height, shared by the chart and its loading placeholder
// so the layout doesn't jump when Chart.js arrives.
export const CHART_HEIGHT = "h-64 sm:h-72";
