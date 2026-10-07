"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { AdminNav } from "./AdminNav";
import { OfficerNav } from "./OfficerNav";
import {
  navItemsByVariant,
  subNavItemsByVariant,
  isNavItemActive,
  isTopNavItemActive,
  type AdminNavCounts,
  type NavVariant,
  type OfficerNavCounts,
} from "@/lib/nav";
import { cn, focusRing } from "@/lib/utils";

interface SidebarProps {
  variant?: NavVariant;
  // Admin only: queue counts beside the nav items.
  adminCounts?: AdminNavCounts | null;
  // Loan Officer only: queue totals beside the queues.
  officerCounts?: OfficerNavCounts | null;
}

export function Sidebar({ variant = "customer", adminCounts = null, officerCounts = null }: SidebarProps) {
  if (variant === "admin") {
    return (
      <WorkspaceSidebar homeHref="/admin">
        <AdminNav counts={adminCounts} />
      </WorkspaceSidebar>
    );
  }
  if (variant === "staff") {
    return (
      <WorkspaceSidebar homeHref="/staff" width="w-64">
        <OfficerNav counts={officerCounts} />
      </WorkspaceSidebar>
    );
  }

  return <AreaSidebar variant={variant} />;
}

// The Administrator and Loan Officer sidebar: from lg up (below that it's
// the header's menu drawer), and it stays in view while the page scrolls.
// 240px for the admin; 256px for the officer, whose queue names are longer.
function WorkspaceSidebar({
  homeHref,
  width = "w-60",
  children,
}: {
  homeHref: string;
  width?: "w-60" | "w-64";
  children: React.ReactNode;
}) {
  return (
    <aside className={`sticky top-0 hidden h-screen ${width} shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex`}>
      <Link href={homeHref} className={cn("flex h-16 shrink-0 items-center border-b border-neutral-200 px-6", focusRing)}>
        <Logo size="sm" />
      </Link>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

// The customer sidebar: top-level items, each with any sub-items underneath.
function AreaSidebar({ variant }: { variant: Exclude<NavVariant, "admin" | "staff"> }) {
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
