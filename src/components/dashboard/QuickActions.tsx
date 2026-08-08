import Link from "next/link";
import { Receipt, ArrowLeftRight, HandCoins, PlusCircle, type LucideIcon } from "lucide-react";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

const actions: QuickAction[] = [
  { label: "View Transactions", href: "#recent-transactions", icon: Receipt },
  { label: "Transfer Funds", href: "/dashboard/transfer", icon: ArrowLeftRight },
  { label: "Apply for Loan", href: "/dashboard/loans/apply", icon: HandCoins },
  { label: "Add Funds", href: "/dashboard/add-funds", icon: PlusCircle },
];

export function QuickActions() {
  return (
    <div className="animate-card-enter grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary-dark">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-xs font-medium text-neutral-700">{label}</span>
        </Link>
      ))}
    </div>
  );
}
