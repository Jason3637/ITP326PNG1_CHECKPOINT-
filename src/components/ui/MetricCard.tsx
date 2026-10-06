import Link from "next/link";
import { type ReactNode } from "react";
import { cn, focusRing } from "@/lib/utils";

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  // What the figure counts - the backend's definition, in plain words.
  definition?: ReactNode;
  // Extra lines under the value (a count breakdown, a sub-figure).
  children?: ReactNode;
  // Makes the whole card a link, e.g. to the queue behind a count.
  href?: string;
  // "li" when the card is itself an item of a metrics list.
  as?: "div" | "li";
  className?: string;
}

// Card's surface, a little tighter (p-4).
const surface = "flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm";

// One KPI: label, figure, and what it means. Single numbers stay numbers -
// no chart.
export function MetricCard({ label, value, definition, children, href, as: Tag = "div", className }: MetricCardProps) {
  const body = (
    <>
      <p className="text-sm font-medium text-neutral-700">{label}</p>
      <p className="mt-1 font-display text-metric font-bold tracking-tight tabular-nums text-neutral-900">{value}</p>
      {children && <div className="mt-1 flex flex-col gap-1">{children}</div>}
      {definition && <p className="mt-auto pt-2 text-helper text-neutral-600">{definition}</p>}
    </>
  );

  if (href) {
    const link = (
      <Link href={href} className={cn(surface, "transition-colors hover:border-primary/40", focusRing, Tag === "div" && className)}>
        {body}
      </Link>
    );
    return Tag === "li" ? <li className={className}>{link}</li> : link;
  }
  return <Tag className={cn(surface, className)}>{body}</Tag>;
}
