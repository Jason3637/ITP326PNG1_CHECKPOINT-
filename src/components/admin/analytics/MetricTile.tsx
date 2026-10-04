interface MetricTileProps {
  label: string;
  value: string;
  definition: string; // the backend's own definition of the figure
}

// One figure: label, value, and exactly what it counts. Single numbers stay
// numbers - no chart.
export function MetricTile({ label, value, definition }: MetricTileProps) {
  return (
    <li className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-neutral-700">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tracking-tight text-neutral-900">{value}</p>
      <p className="mt-2 text-xs text-neutral-600">{definition}</p>
    </li>
  );
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
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 id={id} className="font-display text-lg font-bold tracking-tight text-neutral-900">
          {title}
        </h3>
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{scope}</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>
    </section>
  );
}
