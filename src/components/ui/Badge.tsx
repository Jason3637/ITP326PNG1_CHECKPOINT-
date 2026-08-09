import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Warning/danger use darker-than-token text shades here (not the shared
// --color-warning/--color-danger tokens) because the base tokens are tuned
// to pass AA on white — on their own *-light badge backgrounds they fall
// short (2.9:1 / 3.96:1 against a 4.5:1 requirement for this text size).
// They're deliberately NOT derived from the brand scale at all — status
// meaning (approved/pending/rejected) must stay legible independent of
// brand palette changes. `primary` and `success` DO pull from the shared
// tokens, so `primary` picks up the new brand-50/900 pairing automatically.
const variantClasses = {
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-amber-800",
  danger: "bg-danger-light text-red-700",
  neutral: "bg-neutral-100 text-neutral-600",
  primary: "bg-primary-light text-primary-dark",
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantClasses;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
