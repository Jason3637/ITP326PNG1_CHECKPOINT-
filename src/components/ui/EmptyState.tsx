import { type ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title?: ReactNode;
  children: ReactNode; // what's empty, in plain words
  // A next step, e.g. a "Go to the first page" link.
  action?: ReactNode;
  // "sm": one quiet line, for a section inside a busier page (the
  // dashboard's queues). "md": centred, for a page whose list is empty.
  size?: "sm" | "md";
  className?: string;
}

// "Nothing here" inside a card or list - the queues, filters and tables.
export function EmptyState({ icon: Icon = Inbox, title, children, action, size = "md", className }: EmptyStateProps) {
  if (size === "sm") {
    return (
      <div className={cn("flex items-center gap-2.5 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600", className)}>
        <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {title && <span className="font-medium text-neutral-900">{title} </span>}
          {children}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}>
      <Icon className="h-7 w-7 text-neutral-300" aria-hidden="true" />
      {title && <p className="font-medium text-neutral-900">{title}</p>}
      <div className="text-sm text-neutral-600">{children}</div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// The one-line "nothing here" for a section inside a busier page - a queue
// preview, an empty panel in a review screen. EmptyState's "sm" size under
// a name of its own, so a screen can't drift into the large centred one.
export function CompactEmptyState(props: Omit<EmptyStateProps, "size">) {
  return <EmptyState {...props} size="sm" />;
}
