import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Label/value rows for the review screen. Stacks label over value on
// phones (long emails/names collide side by side at 375px - same fix as
// the member profile page), side by side from sm: up.
export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("flex flex-col divide-y divide-neutral-100", className)}>{children}</dl>;
}

interface DetailRowProps {
  label: string;
  // null/undefined/"" renders the fallback, so a missing value is always
  // visibly missing rather than an empty gap.
  value: ReactNode;
  fallback?: string;
  hint?: ReactNode;
}

export function DetailRow({ label, value, fallback = "Not provided", hint }: DetailRowProps) {
  const missing = value === null || value === undefined || value === "";
  return (
    <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-neutral-600">{label}</dt>
      <dd className="min-w-0 break-words sm:text-right">
        <span className={missing ? "text-neutral-500 italic" : "font-medium text-neutral-900"}>
          {missing ? fallback : value}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-neutral-600">{hint}</span>}
      </dd>
    </div>
  );
}
