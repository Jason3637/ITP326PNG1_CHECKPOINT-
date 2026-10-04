import type { Role } from "./types";

// Routing only - which area of the shared portal a signed-in user belongs
// in. None of this is a security boundary: a customer who forces their way
// onto a /staff or /admin URL still gets 403s from every staff endpoint,
// because the Flask backend checks the role on its own JWT. These helpers
// just keep each kind of user out of an area that was never built for them.
export const STAFF_ROLES: readonly Role[] = ["loan_officer", "admin"];

export const CUSTOMER_HOME = "/dashboard";
export const STAFF_HOME = "/staff"; // the Loan Officer area
export const ADMIN_HOME = "/admin";

// The three areas of the portal. Each role has exactly one: an admin works
// in /admin (built on /api/admin), not in the Loan Officer area, and a loan
// officer never sees /admin.
export type PortalArea = "customer" | "officer" | "admin";

const AREA_HOME: Record<PortalArea, string> = {
  customer: CUSTOMER_HOME,
  officer: STAFF_HOME,
  admin: ADMIN_HOME,
};

// Where a layout sends someone whose /auth/me role doesn't belong in the
// area it renders - see app/api/session/role/route.ts.
export const ROLE_RESYNC_PATH = "/api/session/role";

// Accepts the raw string from the pv_role cookie too, so an unknown or
// tampered value falls through to "not staff" rather than throwing.
export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes(role as Role);
}

// Unknown or missing roles get the customer area - the least privileged.
export function areaForRole(role: string | null | undefined): PortalArea {
  if (role === "admin") return "admin";
  if (role === "loan_officer") return "officer";
  return "customer";
}

function inArea(pathname: string, home: string): boolean {
  return pathname === home || pathname.startsWith(`${home}/`);
}

// Which area a URL belongs to (on a segment boundary, so "/staffing" isn't
// the staff area).
export function areaForPath(pathname: string): PortalArea {
  if (inArea(pathname, ADMIN_HOME)) return "admin";
  if (inArea(pathname, STAFF_HOME)) return "officer";
  return "customer";
}

export function homePathForRole(role: string | null | undefined): string {
  return AREA_HOME[areaForRole(role)];
}

const ROLE_LABELS: Record<Role, string> = {
  customer: "Member",
  loan_officer: "Loan Officer",
  admin: "Admin",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
