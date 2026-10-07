import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// `primary`/`primary-dark` are aliases onto the brand-700/900 scale steps
// (see globals.css) — a solid deep stop, not the full --brand-gradient.
// Reserve the gradient for hero/header surfaces; it reads as noise at
// button size.
//
// Hierarchy: one `primary` per decision; `secondary` for the alternative
// action; `ghost` for back/cancel; `danger` only for an irreversible
// negative action. `outline` is kept for the customer area's existing use.
// `link` is a minor action that reads as text ("Add note", "Start a
// request") - never the main action of a panel.
const variantClasses = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
  outline: "border border-neutral-300 text-neutral-900 hover:bg-neutral-50",
  ghost: "text-neutral-700 hover:bg-neutral-100",
  danger: "bg-danger text-white hover:bg-red-700",
  link: "rounded text-primary hover:text-primary-dark hover:underline underline-offset-2",
} as const;

// md is 40px by default and 44px inside a comfortable-density area.
const sizeClasses = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm comfortable:h-11 comfortable:px-5",
  lg: "h-12 px-6 text-base",
} as const;

// A link-style button has no box to size - only its text size, and a 24px
// minimum height so it's still a big enough target on its own (WCAG 2.2).
const linkSizeClasses = {
  sm: "min-h-6 text-xs",
  md: "min-h-6 text-sm",
  lg: "min-h-6 text-base",
} as const;

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

// The same look for a link that acts as a button (an in-page jump, a
// navigation), so a <Link> or <a> needn't copy the classes.
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: keyof typeof variantClasses; size?: keyof typeof sizeClasses; className?: string } = {}) {
  const sizes = variant === "link" ? linkSizeClasses : sizeClasses;
  return cn(baseClasses, variantClasses[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  // Shows a spinner before the label, disables the button and marks it
  // busy. The label stays, so the button doesn't change width.
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClasses({ variant, size, className })}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
