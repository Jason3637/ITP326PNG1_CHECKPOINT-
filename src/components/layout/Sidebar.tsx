"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { AdminNav } from "./AdminNav";
import {
  navItemsByVariant,
  subNavItemsByVariant,
  isNavItemActive,
  isTopNavItemActive,
  type AdminNavCounts,
  type NavVariant,
} from "@/lib/nav";
import { cn, focusRing } from "@/lib/utils";

interface SidebarProps {
  variant?: NavVariant;
  // Admin only: queue counts beside the nav items.
  adminCounts?: AdminNavCounts | null;
}

export function Sidebar({ variant = "customer", adminCounts = null }: SidebarProps) {
  // The admin area's grouped nav: 240px, from lg up (below that it's the
  // header's menu drawer), and it stays in view while the page scrolls.
  if (variant === "admin") {
    return (
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <Link href="/admin" className={cn("flex h-16 shrink-0 items-center border-b border-neutral-200 px-6", focusRing)}>
          <Logo size="sm" />
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminNav counts={adminCounts} />
        </div>
      </aside>
    );
  }

  return <AreaSidebar variant={variant} />;
}

// The customer and Loan Officer sidebar: top-level items, each with its
// sub-items (the officer's queues) underneath.
function AreaSidebar({ variant }: { variant: Exclude<NavVariant, "admin"> }) {
  const pathname = usePathname();
  const items = navItemsByVariant[variant];
  const subItems = subNavItemsByVariant[variant];

  return (
    <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
      <Link
        href={items[0].href}
        className={cn(
          "flex h-14 items-center border-b border-neutral-200 px-5",
          focusRing,
        )}
      >
        <Logo size="sm" />
      </Link>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isTopNavItemActive(pathname, href, variant);
          const subs = subItems[href] ?? [];
          return (
            <div key={label} className="flex flex-col gap-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  focusRing,
                  active && "bg-primary-light text-primary-dark hover:bg-primary-light hover:text-primary-dark",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
              {subs.length > 0 && (
                <ul className="ml-5 flex flex-col gap-0.5 border-l border-neutral-200 pl-3">
                  {subs.map((sub) => {
                    const subActive = isNavItemActive(pathname, sub.href);
                    return (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          aria-current={subActive ? "page" : undefined}
                          className={cn(
                            "block rounded-md px-2 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                            focusRing,
                            subActive && "bg-primary-light text-primary-dark hover:bg-primary-light hover:text-primary-dark",
                          )}
                        >
                          {sub.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
