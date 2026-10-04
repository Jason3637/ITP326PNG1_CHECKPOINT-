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
