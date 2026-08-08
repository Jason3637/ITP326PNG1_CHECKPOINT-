"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PiggyBank, HandCoins, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard", label: "Savings", icon: PiggyBank },
  { href: "/dashboard", label: "Loans", icon: HandCoins },
  { href: "/dashboard", label: "Profile", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
      <Link
        href="/dashboard"
        className="flex h-14 items-center gap-2 border-b border-neutral-200 px-5 font-semibold text-primary"
      >
        <Wallet className="h-5 w-5" aria-hidden="true" />
        <span>Prime&apos;s Vault</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href && label === "Home";
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                active && "bg-primary-light text-primary-dark hover:bg-primary-light hover:text-primary-dark",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
