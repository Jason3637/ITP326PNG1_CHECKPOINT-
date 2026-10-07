"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { cn, focusRing } from "@/lib/utils";

export interface TabItem<K extends string = string> {
  id: K;
  label: ReactNode;
  // A small figure beside the label (e.g. how many documents).
  count?: number;
  // "attention": the count is work still to do (outstanding checks, open
  // requests), shown in amber so it's noticed from another tab. Default
  // "neutral" is a plain tally.
  countTone?: "neutral" | "attention";
  // What the count means, for screen readers ("outstanding" reads
  // "Verification, 2 outstanding" rather than a bare "2").
  countLabel?: string;
  content: ReactNode;
}

export interface TabsProps<K extends string> {
  // Names the tab list for screen readers.
  label: string;
  tabs: TabItem<K>[];
  // The tab to show first - the page reads it from the URL on the server,
  // so a bookmarked or shared ?tab= link opens on the right tab.
  initialTab: K;
  // The query parameter the selected tab is written to.
  param?: string;
  className?: string;
}

// Tabs over content that is all rendered up front. Every panel stays
// mounted and only the selected one is shown, so switching tabs never
// loses what was typed or expanded in another. The selection is written to
// the URL with history.replaceState (Next keeps its router in sync with
// that): no server round trip, no extra history entries, and any other
// query parameters are kept.
//
// WAI-ARIA tabs pattern: arrow keys, Home and End move between tabs and
// select them; Tab moves from the tab list into the open panel.
export function Tabs<K extends string>({ label, tabs, initialTab, param = "tab", className }: TabsProps<K>) {
  const [selected, setSelected] = useState<K>(tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id);
  const tabRefs = useRef(new Map<K, HTMLButtonElement>());
  const baseId = useId();

  function select(id: K, focus = false) {
    setSelected(id);
    if (focus) tabRefs.current.get(id)?.focus();
    const url = new URL(window.location.href);
    // The first tab is the default, so it keeps the URL clean.
    if (id === tabs[0].id) url.searchParams.delete(param);
    else url.searchParams.set(param, id);
    window.history.replaceState(window.history.state, "", url);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = tabs.findIndex((t) => t.id === selected);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : null;
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].id, true);
  }

  return (
    <div className={className}>
      <div className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" aria-label={label} className="flex min-w-max gap-1 border-b border-neutral-200">
          {tabs.map((t) => {
            const active = t.id === selected;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.id, el);
                  else tabRefs.current.delete(t.id);
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`${baseId}-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(t.id)}
                onKeyDown={onKeyDown}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  focusRing,
                  active
                    ? "border-primary text-primary-dark"
                    : "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-900",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span
                    // With a countLabel the sr-only text below says it all,
                    // so the bare figure isn't read twice.
                    aria-hidden={t.countLabel ? true : undefined}
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                      t.countTone === "attention"
                        ? "bg-warning-light text-amber-800"
                        : active
                          ? "bg-primary-light text-primary-dark"
                          : "bg-neutral-100 text-neutral-600",
                    )}
                  >
                    {t.count}
                  </span>
                )}
                {t.count !== undefined && t.countLabel && (
                  <span className="sr-only">
                    , {t.count} {t.countLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${baseId}-panel-${t.id}`}
          aria-labelledby={`${baseId}-tab-${t.id}`}
          hidden={t.id !== selected}
          tabIndex={0}
          className="mt-5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
