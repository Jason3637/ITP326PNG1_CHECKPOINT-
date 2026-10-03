import { LayoutDashboard, HandCoins, ClipboardList, User, type LucideIcon } from "lucide-react";

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

// "/dashboard" must match exactly - it's also a prefix of every other
// member tab's href. The rest match exactly or on a nested sub-route, which
// includes "/staff": the staff area has a single tab, so it stays highlighted
// on every staff screen (queues, review, customer history). Add "/staff"
// here once the staff nav gets a second tab.
const AREA_ROOTS = new Set(["/dashboard"]);

export function isNavItemActive(pathname: string, href: string): boolean {
  if (AREA_ROOTS.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
