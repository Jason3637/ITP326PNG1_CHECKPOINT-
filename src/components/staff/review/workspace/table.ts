// Shared look for the compact tables in the officer's review tabs. A table
// sits in an overflow-x wrapper so a narrow screen scrolls the table, never
// the page; long values wrap (break-words) rather than widen a column. The
// wrapper is `relative` so visually hidden header text (sr-only is absolutely
// positioned) is clipped by it too - otherwise it escapes the scroll box and
// widens the page.
export const tableWrap = "relative -mx-1 overflow-x-auto px-1";
export const table = "w-full text-left text-sm";
export const th = "border-b border-neutral-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 first:pl-0 last:pr-0";
export const td = "border-b border-neutral-100 px-3 py-2.5 align-top break-words first:pl-0 last:pr-0";
// Figures: right-aligned, digits in columns.
export const num = "text-right tabular-nums whitespace-nowrap";
// The heading of a section inside a tab panel (the panel's cards use h2).
export const sectionHeading = "font-display text-base font-bold tracking-tight text-neutral-900";
