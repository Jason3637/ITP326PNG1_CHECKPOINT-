import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
