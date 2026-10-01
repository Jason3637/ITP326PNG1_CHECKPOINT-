import type { Role } from "./types";

// Routing only - which area of the shared portal a signed-in user belongs
// in. None of this is a security boundary: a customer who forces their way
// onto a /staff URL still gets 403s from every staff endpoint, because the
// Flask backend checks the role on its own JWT. These helpers just keep
// each kind of user out of an area that was never built for them.
export const STAFF_ROLES: readonly Role[] = ["loan_officer", "admin"];

export const CUSTOMER_HOME = "/dashboard";
export const STAFF_HOME = "/staff";

// Where a layout sends someone whose /auth/me role doesn't belong in the
// area it renders - see app/api/session/role/route.ts.
export const ROLE_RESYNC_PATH = "/api/session/role";

// Accepts the raw string from the pv_role cookie too, so an unknown or
// tampered value falls through to "not staff" rather than throwing.
export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes(role as Role);
}

export function homePathForRole(role: string | null | undefined): string {
  return isStaffRole(role) ? STAFF_HOME : CUSTOMER_HOME;
}

const ROLE_LABELS: Record<Role, string> = {
  customer: "Member",
  loan_officer: "Loan Officer",
  admin: "Admin",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
