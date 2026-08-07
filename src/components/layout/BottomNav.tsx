import Link from "next/link";
import { LayoutDashboard, PiggyBank, HandCoins, User } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard", label: "Savings", icon: PiggyBank },
  { href: "/dashboard", label: "Loans", icon: HandCoins },
  { href: "/dashboard", label: "Profile", icon: User },
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-10 border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-neutral-500 hover:text-primary"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
