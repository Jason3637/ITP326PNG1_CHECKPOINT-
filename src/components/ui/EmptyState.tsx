import { type ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title?: ReactNode;
  children: ReactNode; // what's empty, in plain words
  // A next step, e.g. a "Go to the first page" link.
  action?: ReactNode;
  className?: string;
}

// "Nothing here" inside a card or list - the queues, filters and tables.
export function EmptyState({ icon: Icon = Inbox, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}>
      <Icon className="h-7 w-7 text-neutral-300" aria-hidden="true" />
      {title && <p className="font-medium text-neutral-900">{title}</p>}
      <div className="text-sm text-neutral-600">{children}</div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
