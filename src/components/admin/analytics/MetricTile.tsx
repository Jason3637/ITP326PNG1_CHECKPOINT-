import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils";

interface MetricTileProps {
  label: string;
  value: string;
  definition: string; // the backend's own definition of the figure
  // md: a headline figure; sm: a supporting one, a step quieter.
  size?: "md" | "sm";
}

// One figure in a MetricRow: label, value, and exactly what it counts.
export function MetricTile({ label, value, definition, size = "md" }: MetricTileProps) {
  return <MetricCard as="li" size={size} label={label} value={value} definition={definition} />;
}

// Column counts settle as the screen widens; a figure never gets narrower
// than its value needs.
const COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
} as const;

export function MetricRow({ columns, children }: { columns: keyof typeof COLUMNS; children: React.ReactNode }) {
  return <ul className={cn("grid grid-cols-1 gap-4", COLUMNS[columns])}>{children}</ul>;
}

// A titled group of figures. `scope` says whether they count what happened
// in the chosen dates or are a snapshot as of now, so window and stock
// figures never blur.
export function MetricGroup({
  title,
  scope,
  description,
  children,
}: {
  title: string;
  scope: string;
  description?: string;
  children: React.ReactNode; // MetricRows
}) {
  const id = `metrics-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionHeader id={id} as="h3" title={title} scope={scope} description={description} />
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
