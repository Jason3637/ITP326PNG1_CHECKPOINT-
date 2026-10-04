import type { CategoryBreakdown } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A ?from= / ?to= value, or null. The backend validates the range itself
// (from <= to); this only keeps junk out of the request.
export function parseDateParam(value: string | string[] | undefined): string | null {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface TrendWindow {
  from: string;
  to: string;
  label: string; // the full week, for tables and tooltips
  axisLabel: string; // its start date, short enough for a chart axis
}

// Consecutive 7-day windows ending on `to`, oldest first. Each is sent to
// GET /admin/analytics as its own from/to, so every trend point is the
// backend's figure for that week - nothing is bucketed in the browser.
export function weeklyWindows(to: string, weeks = 8): TrendWindow[] {
  return Array.from({ length: weeks }, (_, i) => {
    const end = addDays(to, -7 * (weeks - 1 - i));
    const start = addDays(end, -6);
    return { from: start, to: end, label: `${shortDate(start)}–${shortDate(end)}`, axisLabel: shortDate(start) };
  });
}

// A date range preset: the last `days` days ending today (Port Moresby).
export function lastDays(today: string, days: number): { from: string; to: string } {
  return { from: addDays(today, -(days - 1)), to: today };
}

export function analyticsHref(range: { from?: string | null; to?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const qs = params.toString();
  return `/admin/analytics${qs ? `?${qs}` : ""}`;
}

// 0.6667 -> "66.7%"; null (nothing decided) -> "—".
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 1000) / 10}%`;
}

// Hours from the backend -> "5.5 hours" / "3.2 days"; null -> "—".
export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 48) return `${Math.round(hours * 10) / 10} hours`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}

// Category rows in tier order: PRIME 1, PRIME 2, ... PRIME 10, then
// anything that isn't PRIME. The figures are the backend's, untouched.
export function categoryRows(breakdown: CategoryBreakdown): { category: string; count: number; amount: number }[] {
  const tier = (c: string) => {
    const m = /^PRIME (\d+)$/.exec(c);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };
  return Object.entries(breakdown)
    .map(([category, v]) => ({ category, count: v.count, amount: v.amount }))
    .sort((a, b) => tier(a.category) - tier(b.category) || a.category.localeCompare(b.category));
}
