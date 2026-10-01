import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface ActionTile {
  label: string;
  href: string;
  icon: LucideIcon;
  // Primary CTA for this row — solid brand color, not the gradient (see
  // globals.css: gradient is reserved for hero/header surfaces).
  primary?: boolean;
}

// Extracted from the original QuickActions grid so every dashboard state
// (no loan, application in progress, active loan) renders its action tiles
// identically instead of each hand-rolling its own grid markup.
export function ActionTiles({ actions }: { actions: ActionTile[] }) {
  return (
    <div className="animate-card-enter grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map(({ label, href, icon: Icon, primary }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-4 text-center shadow-sm transition-colors",
            // bg-primary (brand-700) + white text measures right at the AA
            // threshold for small text (~4.4:1 vs 4.5:1 required) as
            // actually rendered — confirmed with axe-core, not just a CSS
            // hex comparison. bg-primary-dark (brand-900) gives a safe 8:1.
            primary
              ? "border-transparent bg-primary-dark hover:opacity-90"
              : "border-neutral-200 bg-white hover:border-primary hover:bg-primary-light",
            focusRing,
          )}
        >
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              primary ? "bg-white/20 text-white" : "bg-primary-light text-primary-dark",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className={cn("text-xs font-medium", primary ? "text-white" : "text-neutral-700")}>{label}</span>
        </Link>
      ))}
    </div>
  );
}
