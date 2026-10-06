import Link from "next/link";
import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

// How loudly a figure asks for attention.
//   neutral   a plain figure (analytics, financial KPIs)
//   attention there is work waiting - brand border, raised
//   critical  something has gone wrong (overdue) - red border, red figure
//   calm      nothing waiting - flat, figure greyed, so non-zero cards stand out
export type MetricTone = "neutral" | "attention" | "critical" | "calm";

const TONE = {
  neutral: { box: "border-neutral-200 shadow-sm", value: "text-neutral-900", icon: "bg-neutral-100 text-neutral-600" },
  attention: { box: "border-primary/50 shadow-md", value: "text-neutral-900", icon: "bg-primary-light text-primary-dark" },
  critical: { box: "border-danger/50 shadow-md", value: "text-red-700", icon: "bg-danger-light text-red-700" },
  calm: { box: "border-neutral-200", value: "text-neutral-500", icon: "bg-neutral-100 text-neutral-500" },
} as const;

// md: the headline figures. sm: secondary figures, a step down so they
// don't compete with the ones that ask for action.
const SIZE = {
  md: { pad: "p-4 sm:p-5", value: "text-metric" },
  sm: { pad: "p-4", value: "text-2xl" },
} as const;

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  // What the figure counts - the backend's definition, in plain words.
  definition?: ReactNode;
  // One short line right under the value ("3 waiting on you", "K310 owed").
  status?: ReactNode;
  // Extra lines under the value (a count breakdown, a sub-figure).
  children?: ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  size?: keyof typeof SIZE;
  // Makes the whole card a link, e.g. to the queue behind a count.
  href?: string;
  // "li" when the card is itself an item of a metrics list.
  as?: "div" | "li";
  className?: string;
}

// One KPI: label, figure, and what it means. Single numbers stay numbers -
// no chart. Card's surface, a little tighter.
export function MetricCard({
  label,
  value,
  definition,
  status,
  children,
  icon: Icon,
  tone = "neutral",
  size = "md",
  href,
  as: Tag = "div",
  className,
}: MetricCardProps) {
  const t = TONE[tone];
  const s = SIZE[size];
  const surface = cn("flex h-full flex-col rounded-xl border bg-white", t.box, s.pad);

  const body = (
    <>
      {Icon ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-neutral-700">{label}</p>
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", t.icon)} aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
        </div>
      ) : (
        <p className="text-sm font-medium text-neutral-700">{label}</p>
      )}
      <p className={cn("mt-1 font-display font-bold tracking-tight tabular-nums", s.value, t.value)}>{value}</p>
      {status && <p className="mt-0.5 text-sm text-neutral-600">{status}</p>}
      {children && <div className="mt-1 flex flex-col gap-1">{children}</div>}
      {definition && <p className="mt-auto pt-2 text-helper text-neutral-600">{definition}</p>}
    </>
  );

  if (href) {
    const link = (
      <Link
        href={href}
        className={cn(surface, "transition-colors hover:border-primary hover:bg-neutral-50", focusRing, Tag === "div" && className)}
      >
        {body}
      </Link>
    );
    return Tag === "li" ? <li className={className}>{link}</li> : link;
  }
  return <Tag className={cn(surface, className)}>{body}</Tag>;
}
