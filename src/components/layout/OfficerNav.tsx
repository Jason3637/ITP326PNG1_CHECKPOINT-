"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavDrawer } from "./NavDrawer";
import { isOfficerNavItemActive, officerNavSections, type OfficerNavCounts } from "@/lib/nav";
import { cn, focusRing } from "@/lib/utils";

interface OfficerNavProps {
  // Null when GET /officer/queues couldn't be read - queues then show no count.
  counts: OfficerNavCounts | null;
}

// A queue's total. The pill is for the eye; screen readers get the words
// (", 2 applications") so the link reads "New Applications, 2 applications".
function Count({ count }: { count: number }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "ml-auto min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
          count === 0 ? "bg-neutral-100 text-neutral-500" : "bg-primary-light text-primary-dark",
        )}
      >
        {count}
      </span>
      <span className="sr-only">
        , {count} {count === 1 ? "application" : "applications"}
      </span>
    </>
  );
}

// The Loan Officer's navigation: Overview, then the work queues under
// "Applications". The current item is marked by a bar, weight and tint as
// well as aria-current - never by colour alone.
export function OfficerNav({ counts }: OfficerNavProps) {
  const pathname = usePathname();
  // Unique per instance: the sidebar and the phone drawer are both mounted.
  const idPrefix = useId();

  return (
    <nav aria-label="Loan Officer" className="flex flex-col gap-5 p-3">
      {officerNavSections.map((section, i) => {
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
                const active = isOfficerNavItemActive(pathname, item.href);
                const count = item.queue ? counts?.[item.queue] : undefined;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                        focusRing,
                        active &&
                          "bg-primary-light font-semibold text-primary-dark hover:bg-primary-light hover:text-primary-dark",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary" aria-hidden="true" />
                      )}
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {/* Wraps rather than truncates: "Awaiting Customer
                          Information" should be readable in full. */}
                      <span className="min-w-0 leading-snug">{item.label}</span>
                      {count !== undefined && <Count count={count} />}
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

// The officer nav below lg (see NavDrawer).
export function OfficerNavDrawer({ counts }: { counts: OfficerNavCounts | null }) {
  return (
    <NavDrawer>
      <OfficerNav counts={counts} />
    </NavDrawer>
  );
}
