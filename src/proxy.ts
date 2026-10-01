import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, ROLE_COOKIE } from "@/lib/session";
import { CUSTOMER_HOME, STAFF_HOME, isStaffRole } from "@/lib/roles";

// Coarse, fast gate: no session cookie at all (never logged in, or fully
// logged out) means an immediate redirect, before any dashboard code runs.
// If only the access token is missing but a refresh token is present,
// the request is let through - serverApiFetch() transparently refreshes
// on first call, so we don't duplicate that logic here.
//
// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` (file
// and exported function both renamed) - verified against this project's
// actual installed Next.js version's docs, not assumed from training data.
export function proxy(request: NextRequest) {
  const hasAccess = request.cookies.has(ACCESS_COOKIE);
  const hasRefresh = request.cookies.has(REFRESH_COOKIE);

  if (!hasAccess && !hasRefresh) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Portal routing from the pv_role cookie (set from the backend's
  // /auth/me at login - see app/api/session/route.ts). UX only, not a
  // security boundary: each area's layout re-checks the role against
  // /auth/me, and the backend enforces it on every endpoint. A missing
  // role cookie is let through for the layout to decide.
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  if (role) {
    const { pathname } = request.nextUrl;
    const onStaffArea = pathname === STAFF_HOME || pathname.startsWith(`${STAFF_HOME}/`);
    const staff = isStaffRole(role);

    if (onStaffArea && !staff) {
      return NextResponse.redirect(new URL(CUSTOMER_HOME, request.url));
    }
    if (!onStaffArea && staff) {
      return NextResponse.redirect(new URL(STAFF_HOME, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/staff/:path*"],
};
