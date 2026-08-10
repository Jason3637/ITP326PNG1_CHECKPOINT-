import Link from "next/link";
import { Receipt, HandCoins, BadgeCheck, Calculator, type LucideIcon } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  // Primary CTA for this row — solid brand color, not the gradient (see
  // globals.css: gradient is reserved for hero/header surfaces).
  primary?: boolean;
}

const actions: QuickAction[] = [
  { label: "Repayment History", href: "#recent-transactions", icon: Receipt },
  { label: "Apply for Loan", href: "/dashboard/loans/apply", icon: HandCoins, primary: true },
  { label: "Check Eligibility", href: "/dashboard/loans/eligibility", icon: BadgeCheck },
  { label: "Loan Calculator", href: "/dashboard/loans/calculator", icon: Calculator },
];

export function QuickActions() {
  return (
    <div className="animate-card-enter grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map(({ label, href, icon: Icon, primary }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-4 text-center shadow-sm transition-colors",
            primary
              ? "border-transparent bg-primary hover:bg-primary-dark"
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
          <span className={cn("text-xs font-medium", primary ? "text-white" : "text-neutral-700")}>
            {label}
          </span>
        </Link>
      ))}
    </div>
  );
}
