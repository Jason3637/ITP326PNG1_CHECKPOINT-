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

// "/dashboard" itself must match exactly (it's also a prefix of every
// other tab's href) - the rest match exactly or on a nested sub-route.
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
