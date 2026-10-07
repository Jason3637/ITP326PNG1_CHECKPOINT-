import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status-tone";

const BAR: Record<StatusTone | "primary", string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral-400",
};

export interface ProgressSummaryProps {
  // What is being counted - also the progress bar's accessible name.
  label: string;
  value: number;
  total: number;
  // Replaces the default "{value} of {total}" wording.
  valueText?: string;
  // A badge for the overall state ("All required checks done"). Words are
  // required; the icon defaults to the tone's.
  status?: { tone: StatusTone; label: ReactNode; icon?: LucideIcon };
  // Bar colour. Default: success when complete, primary while in progress.
  tone?: StatusTone | "primary";
  // Detail under the bar - e.g. what's still outstanding.
  children?: ReactNode;
  className?: string;
}

// How far along something is - "3 of 5 required checks done" - as words,
// a bar and an optional status badge. The words carry the meaning; the bar
// and colour only repeat it.
export function ProgressSummary({
  label,
  value,
  total,
  valueText,
  status,
  tone,
  children,
  className,
}: ProgressSummaryProps) {
  const max = Math.max(0, total);
  const now = Math.min(Math.max(0, value), max);
  const percent = max === 0 ? 0 : Math.round((now / max) * 100);
  const complete = max > 0 && now === max;
  const text = valueText ?? `${now} of ${max}`;
  const barTone = tone ?? (complete ? "success" : "primary");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">{label}:</span> <span className="tabular-nums">{text}</span>
        </p>
        {status && (
          <StatusBadge tone={status.tone} icon={status.icon ?? true}>
            {status.label}
          </StatusBadge>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={now}
        aria-valuetext={text}
        className="h-2 overflow-hidden rounded-full bg-neutral-100"
      >
        <div className={cn("h-full rounded-full", BAR[barTone])} style={{ width: `${percent}%` }} />
      </div>
      {children && <div className="text-sm text-neutral-700">{children}</div>}
    </div>
  );
}
