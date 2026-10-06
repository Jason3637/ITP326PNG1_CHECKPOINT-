"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavSections, isNavItemActive, type AdminNavCounts, type AdminNavItem } from "@/lib/nav";
import { cn, focusRing } from "@/lib/utils";

interface AdminNavProps {
  // Null when GET /admin/queues couldn't be read - items then show no count.
  counts: AdminNavCounts | null;
  // Called when a link is followed (the phone drawer closes itself).
  onNavigate?: () => void;
}

function Count({ item, count }: { item: AdminNavItem; count: number }) {
  return (
    <span
      className={cn(
        "ml-auto min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
        count === 0
          ? "bg-neutral-100 text-neutral-500"
          : item.urgent
            ? "bg-danger-light text-red-700"
            : "bg-primary-light text-primary-dark",
      )}
    >
      {/* Read as "Overdue (2)", not "Overdue2". */}
      <span className="sr-only">(</span>
      {count}
      <span className="sr-only">)</span>
    </span>
  );
}

// The Administrator's sections. Highlighting is the shared rule
// (isNavItemActive): no two admin hrefs overlap, so at most one item is
// current - and on a detail page (an application, a loan) none is, as before.
export function AdminNav({ counts, onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  // Unique per instance: the sidebar and the phone drawer are both mounted.
  const idPrefix = useId();

  return (
    <nav aria-label="Administrator" className="flex flex-col gap-5 p-3">
      {adminNavSections.map((section, i) => {
        const labelId = section.label ? `${idPrefix}-${i}` : undefined;
        return (
          <div key={section.label ?? `top-${i}`} className="flex flex-col gap-0.5">
            {section.label && (
              // A label, not a heading: the page's own headings shouldn't
              // share an outline with the nav.
              <p id={labelId} className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {section.label}
              </p>
            )}
            <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                const count = item.countKey ? counts?.[item.countKey] : undefined;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                        focusRing,
                        active && "bg-primary-light text-primary-dark hover:bg-primary-light hover:text-primary-dark",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{item.label}</span>
                      {count !== undefined && (
                        <>
                          {/* A real space, so the name reads "Overdue (2)". */}{" "}
                          <Count item={item} count={count} />
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
