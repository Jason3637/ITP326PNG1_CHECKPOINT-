import { Card } from "@/components/ui/Card";
import { ChartFrame } from "./ChartFrame";
import type { ChartSpec } from "./chart-spec";

interface ChartCardProps {
  title: string;
  subtitle: string;
  spec: ChartSpec;
  // The same figures as a table - always rendered on the server, so they
  // don't depend on the chart (or JavaScript) loading.
  table: { headers: [string, string]; rows: [string, string][] };
  emptyMessage: string;
}

// One chart, one series: the title names it, so there's no legend box.
// The table under it carries every exact value.
export function ChartCard({ title, subtitle, spec, table, emptyMessage }: ChartCardProps) {
  const empty = spec.values.every((v) => v === 0);
  return (
    <Card className="flex flex-col">
      <h4 className="font-display text-lg font-bold tracking-tight text-neutral-900">{title}</h4>
      <p className="mt-0.5 text-helper text-neutral-600">{subtitle}</p>
      <div className="mt-4">
        {empty ? (
          <p className="flex h-24 items-center justify-center rounded-lg bg-neutral-50 text-sm text-neutral-600">{emptyMessage}</p>
        ) : (
          <ChartFrame spec={spec} />
        )}
      </div>
      <details className="mt-4 border-t border-neutral-100 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-neutral-700">Show as a table</summary>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-600">
              <th className="py-1.5 font-medium">{table.headers[0]}</th>
              <th className="py-1.5 text-right font-medium">{table.headers[1]}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map(([k, v]) => (
              <tr key={k} className="border-b border-neutral-100">
                <td className="py-1.5 text-neutral-700">{k}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
