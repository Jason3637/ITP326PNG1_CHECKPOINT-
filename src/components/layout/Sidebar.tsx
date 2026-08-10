"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { navItems, isNavItemActive } from "@/lib/nav";
import { cn, focusRing } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
      <Link
        href="/dashboard"
        className={cn(
          "flex h-14 items-center gap-2 border-b border-neutral-200 px-5 font-display font-bold tracking-tight text-primary",
          focusRing,
        )}
      >
        <div className="relative h-5 w-5 shrink-0">
          <Logo variant="mark" fill sizes="20px" />
        </div>
        <span>Prime&apos;s Vault</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                focusRing,
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
