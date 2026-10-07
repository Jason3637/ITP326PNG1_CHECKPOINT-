import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";
import { TONE_ICONS, statusTone, type StatusTone } from "@/lib/status-tone";

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
  // Opt-in: an icon in place of the dot, so the status reads by shape as
  // well as words and colour. `true` uses the tone's icon (TONE_ICONS); a
  // component uses that icon (e.g. statusPresentation()'s). Without it the
  // badge keeps the dot.
  icon?: boolean | LucideIcon;
  // The words shown. Always required - colour never carries the meaning alone.
  children: ReactNode;
  className?: string;
}

// The one way a status is shown: a tone-coloured pill with a dot or icon.
export function StatusBadge({ status, tone, icon, children, className }: StatusBadgeProps) {
  const t = tone ?? statusTone(status);
  const Icon = icon === true ? TONE_ICONS[t] : icon || null;
  return (
    <Badge variant={t} className={cn("gap-1.5 whitespace-nowrap", className)}>
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[t])} aria-hidden="true" />
      )}
      {children}
    </Badge>
  );
}
