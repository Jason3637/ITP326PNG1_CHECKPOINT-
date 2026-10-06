import { type ReactNode } from "react";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";
import { statusTone, type StatusTone } from "@/lib/status-tone";

const DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral-400",
};

export interface StatusBadgeProps {
  // A backend status value; its tone comes from statusTone().
  status?: string | null;
  // Overrides the tone, for a status that depends on more than one field
  // (e.g. a closed loan's closure reason).
  tone?: StatusTone;
  // The words shown. Always required - colour never carries the meaning alone.
  children: ReactNode;
  className?: string;
}

// The one way a status is shown: a tone-coloured pill with a dot.
export function StatusBadge({ status, tone, children, className }: StatusBadgeProps) {
  const t = tone ?? statusTone(status);
  return (
    <Badge variant={t} className={cn("gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[t])} aria-hidden="true" />
      {children}
    </Badge>
  );
}
