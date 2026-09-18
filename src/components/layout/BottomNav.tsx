"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, isNavItemActive } from "@/lib/nav";
import { cn, focusRing } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 border-t border-neutral-200 bg-white md:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:text-primary",
                focusRing,
                active && "text-primary",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
