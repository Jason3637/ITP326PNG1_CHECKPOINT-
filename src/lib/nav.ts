import {
  LayoutDashboard,
  HandCoins,
  ClipboardList,
  User,
  BarChart3,
  SlidersHorizontal,
  ScrollText,
  Scale,
  Banknote,
  CalendarClock,
  CalendarRange,
  CalendarX,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { OFFICER_QUEUES } from "./officer-queues";
import { adminQueueDefinition, adminQueueHref } from "./admin-queues";
import type { AdminQueue } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Shared by Sidebar and BottomNav so the tab set can't drift between the
// two — Loans (active/past loans) and Applications (pending/approved/
// rejected requests, before a loan becomes active) are deliberately kept
// separate: they're different lifecycle stages a member checks for
// different reasons, not the same list twice. Revisit only if usage shows
// members can't find one from the other.
export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/loans", label: "Loans", icon: HandCoins },
  { href: "/dashboard/applications", label: "Applications", icon: ClipboardList },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

// Loan Officer area. Only lists routes that exist - tabs are added as each
// staff screen is built, never as placeholders that 404.
export const staffNavItems: NavItem[] = [{ href: "/staff", label: "Overview", icon: LayoutDashboard }];

// ---- Administrator area -----------------------------------------------------
// Grouped by the work: decide and pay out applications, watch loans, check
// repayments, then reporting and administration. Grouping is presentation
// only - every href is an existing route, and queue labels and URLs come
// from ADMIN_QUEUES so they can't drift from the dashboard's.

export interface AdminNavItem extends NavItem {
  // The queue whose count (GET /admin/queues) shows beside the item.
  countKey?: AdminQueue;
  // Red when non-zero, for counts that mean something has gone wrong.
  urgent?: boolean;
}

export interface AdminNavSection {
  // null: ungrouped top-level items (Overview, Analytics).
  label: string | null;
  items: AdminNavItem[];
}

const QUEUE_ICONS: Record<AdminQueue, LucideIcon> = {
  awaiting_decision: Scale,
  awaiting_disbursement: Banknote,
  active_loans: HandCoins,
  due_today: CalendarClock,
  due_this_week: CalendarRange,
  overdue: CalendarX,
  repayments_awaiting_verification: ReceiptText,
};

// Counts shown only on the queues that are work waiting on an administrator.
const COUNTED: Partial<Record<AdminQueue, { urgent?: boolean }>> = {
  awaiting_decision: {},
  awaiting_disbursement: {},
  overdue: { urgent: true },
  repayments_awaiting_verification: {},
};

function queueItem(key: AdminQueue): AdminNavItem {
  const counted = COUNTED[key];
  return {
    href: adminQueueHref(key),
    label: adminQueueDefinition(key).navLabel,
    icon: QUEUE_ICONS[key],
    ...(counted ? { countKey: key, urgent: counted.urgent } : {}),
  };
}

export const adminNavSections: AdminNavSection[] = [
  { label: null, items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }] },
  { label: "Applications", items: [queueItem("awaiting_decision"), queueItem("awaiting_disbursement")] },
  {
    label: "Loans",
    items: [queueItem("active_loans"), queueItem("due_today"), queueItem("due_this_week"), queueItem("overdue")],
  },
  { label: "Repayments", items: [queueItem("repayments_awaiting_verification")] },
  { label: null, items: [{ href: "/admin/analytics", label: "Analytics", icon: BarChart3 }] },
  {
    label: "Administration",
    items: [
      { href: "/admin/settings", label: "Settings", icon: SlidersHorizontal },
      { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
    ],
  },
];

export const adminNavItems: AdminNavItem[] = adminNavSections.flatMap((s) => s.items);

// Queue counts for the admin nav, keyed by queue. Plain numbers so the
// server layout can hand them to the client nav.
export type AdminNavCounts = Partial<Record<AdminQueue, number>>;

// Picked by name inside the client nav components rather than passed in as
// a prop: NavItem.icon is a component, which can't cross the server-to-
// client boundary from a layout.
export type NavVariant = "customer" | "staff" | "admin";

export const navItemsByVariant: Record<NavVariant, NavItem[]> = {
  customer: navItems,
  staff: staffNavItems,
  admin: adminNavItems,
};

export interface SubNavItem {
  href: string;
  label: string;
}

// The five work queues, listed under Overview in the desktop sidebar so the
// current queue is highlighted. Built from OFFICER_QUEUES, so the labels and
// URLs can't drift from the dashboard's. Not in the phone bottom bar: six
// tabs don't fit there, and the dashboard links every queue anyway.
export const staffQueueNavItems: SubNavItem[] = OFFICER_QUEUES.map((q) => ({
  href: `/staff/queues/${q.key}`,
  label: q.summaryLabel,
}));

// The admin area has no sub-items: its queues are items of their own
// sections (adminNavSections).
export const subNavItemsByVariant: Record<NavVariant, Record<string, SubNavItem[]>> = {
  customer: {},
  staff: { "/staff": staffQueueNavItems },
  admin: {},
};

// A top-level item is highlighted by the same rule as everywhere else
// (isNavItemActive) unless one of its own sub-items is the current page -
// then that sub-item is highlighted instead, so exactly one entry is active.
// So on a queue page the queue lights up; on the staff dashboard, review and
// customer-history pages, Overview does.
export function isTopNavItemActive(pathname: string, href: string, variant: NavVariant): boolean {
  if (!isNavItemActive(pathname, href)) return false;
  return !(subNavItemsByVariant[variant][href] ?? []).some((sub) => isNavItemActive(pathname, sub.href));
}

// "/dashboard" and "/admin" must match exactly - each is a prefix of every
// other tab's href in its area. The rest match exactly or on a nested sub-route, which
// includes "/staff": Overview covers every staff screen that isn't a queue
// page (see isTopNavItemActive for how queue sub-items take over).
const AREA_ROOTS = new Set(["/dashboard", "/admin"]);

export function isNavItemActive(pathname: string, href: string): boolean {
  if (AREA_ROOTS.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
