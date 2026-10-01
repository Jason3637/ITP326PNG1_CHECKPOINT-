import { NextRequest, NextResponse } from "next/server";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { updateRoleCookie } from "@/lib/session";
import { homePathForRole } from "@/lib/roles";
import type { MeResponse } from "@/lib/types";

// Re-syncs the pv_role cookie from the backend, then sends the user to
// their own area. The (dashboard) and (staff) layouts redirect here when
// /auth/me disagrees with the area being rendered - without it, a stale or
// edited pv_role cookie would have src/proxy.ts and the layouts bouncing
// the user between /dashboard and /staff forever. A layout can't fix the
// cookie itself: cookies can only be written from a Route Handler or
// Server Action, not during a Server Component render.
export async function GET(request: NextRequest) {
  try {
    const me = await serverApiFetch<MeResponse>("/auth/me");
    await updateRoleCookie(me.role);
    return NextResponse.redirect(new URL(homePathForRole(me.role), request.url));
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    throw err;
  }
}
