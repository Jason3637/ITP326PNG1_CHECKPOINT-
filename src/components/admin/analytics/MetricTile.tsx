import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface MetricTileProps {
  label: string;
  value: string;
  definition: string; // the backend's own definition of the figure
}

// One figure in a MetricGroup's list: label, value, and exactly what it
// counts.
export function MetricTile({ label, value, definition }: MetricTileProps) {
  return <MetricCard as="li" label={label} value={value} definition={definition} />;
}

export function MetricGroup({
  title,
  scope,
  children,
}: {
  title: string;
  scope: string; // "In the period" / "As of now" - so window and stock figures never blur
  children: React.ReactNode;
}) {
  const id = `metrics-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionHeader id={id} as="h3" title={title} scope={scope} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>
    </section>
  );
}
