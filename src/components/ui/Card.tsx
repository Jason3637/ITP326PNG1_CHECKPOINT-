import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// The content surface. `emphasis` is the stronger treatment for the one
// important or interactive surface on a screen (a decision form, an open
// editor) - use it sparingly or it stops meaning anything.
const variantClasses = {
  default: "border-neutral-200 shadow-sm",
  emphasis: "border-primary/40 shadow-md",
} as const;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variantClasses;
}

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-xl border bg-white p-5", variantClasses[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-center justify-between", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  // h2, not h3 - the dashboard shell's Header renders the only h1 ("Hello,
  // {name}"), and every CardTitle is the top-level heading of its own page
  // content beneath that, not nested under some other h2 that doesn't
  // exist. h3 skipped a level (confirmed with axe-core's heading-order
  // rule) on every page that uses this shared component.
  return (
    <h2
      className={cn("font-display text-lg font-bold tracking-tight text-neutral-900", className)}
      {...props}
    />
  );
}
