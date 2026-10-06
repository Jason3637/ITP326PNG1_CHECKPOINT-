import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  // A link back up, shown above the title.
  back?: { href: string; label: string };
  // Next to the title, e.g. a StatusBadge.
  meta?: ReactNode;
  // Right-aligned on wide screens, under the title on phones.
  actions?: ReactNode;
  className?: string;
}

// The top of a page. The title is an h2: the shell's Header holds the only
// h1 (see CardTitle for why).
export function PageHeader({ title, description, back, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {back && (
        <Link
          href={back.href}
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded py-1 text-sm font-medium text-primary hover:text-primary-dark",
            focusRing,
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-display text-page-title font-bold tracking-tight text-neutral-900">{title}</h2>
            {meta}
          </div>
          {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
