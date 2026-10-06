"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { navItemsByVariant, subNavItemsByVariant, isNavItemActive, isTopNavItemActive, type NavVariant } from "@/lib/nav";
import { cn, focusRing } from "@/lib/utils";

export function Sidebar({ variant = "customer" }: { variant?: NavVariant }) {
  const pathname = usePathname();
  const items = navItemsByVariant[variant];
  const subItems = subNavItemsByVariant[variant];

  return (
    <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
      <Link
        href={items[0].href}
        className={cn(
          "flex h-14 items-center gap-2 border-b border-neutral-200 px-5 font-display font-bold tracking-tight text-primary",
          focusRing,
        )}
      >
        <div className="relative h-5 w-5 shrink-0">
          <Logo variant="mark" fill sizes="20px" />
        </div>
        <span>PRIMESTONE</span>
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
