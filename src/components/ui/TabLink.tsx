"use client";

import { type ReactNode } from "react";
import { TAB_SELECT_EVENT } from "./Tabs";
import { cn, focusRing } from "@/lib/utils";

// A link from inside one tab to another tab of the page's Tabs
// (history="push"), e.g. from a document to its verification check. A real
// ?tab= link - it works without script and opens in a new tab with a
// modifier key - that otherwise switches tab in place, with no reload.
export function TabLink({ tab, children, className }: { tab: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={`?tab=${encodeURIComponent(tab)}`}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(TAB_SELECT_EVENT, { detail: { tab } }));
      }}
      className={cn("rounded text-sm font-medium text-primary hover:text-primary-dark hover:underline", focusRing, className)}
    >
      {children}
    </a>
  );
}
