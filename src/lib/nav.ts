import { LayoutDashboard, HandCoins, ClipboardList, User, type LucideIcon } from "lucide-react";
import { OFFICER_QUEUES } from "./officer-queues";

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

// Staff (loan_officer/admin) area. Only lists routes that exist - tabs are
// added as each staff screen is built, never as placeholders that 404.
export const staffNavItems: NavItem[] = [{ href: "/staff", label: "Overview", icon: LayoutDashboard }];

// Picked by name inside the client nav components rather than passed in as
// a prop: NavItem.icon is a component, which can't cross the server-to-
// client boundary from a layout.
export type NavVariant = "customer" | "staff";

export const navItemsByVariant: Record<NavVariant, NavItem[]> = {
  customer: navItems,
  staff: staffNavItems,
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

export const subNavItemsByVariant: Record<NavVariant, Record<string, SubNavItem[]>> = {
  customer: {},
  staff: { "/staff": staffQueueNavItems },
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

// "/dashboard" must match exactly - it's also a prefix of every other
// member tab's href. The rest match exactly or on a nested sub-route, which
// includes "/staff": Overview covers every staff screen that isn't a queue
// page (see isTopNavItemActive for how queue sub-items take over).
const AREA_ROOTS = new Set(["/dashboard"]);

export function isNavItemActive(pathname: string, href: string): boolean {
  if (AREA_ROOTS.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
