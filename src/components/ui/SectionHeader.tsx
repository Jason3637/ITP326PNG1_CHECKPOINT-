import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: ReactNode;
  // For aria-labelledby on the surrounding <section>.
  id?: string;
  // h2 for a section directly under the page title, h3 beneath an h2.
  as?: "h2" | "h3";
  description?: ReactNode;
  // A short scope beside the title, e.g. "In the period" / "As of 6 Oct".
  scope?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

// The heading of a page section - above its cards, not inside one (that's
// CardTitle).
export function SectionHeader({ title, id, as: Heading = "h2", description, scope, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <Heading id={id} className="font-display text-section-title font-bold tracking-tight text-neutral-900">
            {title}
          </Heading>
          {scope && <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{scope}</span>}
        </div>
        {description && <p className="mt-0.5 text-sm text-neutral-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
