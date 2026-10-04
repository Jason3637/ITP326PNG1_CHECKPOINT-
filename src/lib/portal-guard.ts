import "server-only";
import { redirect } from "next/navigation";
import { serverApiFetch, UnauthenticatedError, ApiError } from "./server-api";
import { ROLE_RESYNC_PATH, areaForRole, type PortalArea } from "./roles";
import type { MeResponse } from "./types";

// The check every area layout ((dashboard), (staff), (admin)) runs before
// rendering. It reads /auth/me - the backend's answer, not the pv_role
// cookie src/proxy.ts uses - so it's the authoritative routing decision on
// the frontend. It is still NOT the security boundary: the backend rejects
// the wrong role's token on every endpoint regardless of what renders.
//
// - No valid session, or a reachable-but-erroring backend: back to /login
//   rather than broken chrome with no confirmed user.
// - Signed in but in another role's area: via the role re-sync route, not
//   straight to their home, in case a stale pv_role cookie is what sent
//   them here (see app/api/session/role/route.ts).
export async function requireAreaUser(area: PortalArea): Promise<MeResponse> {
  let me: MeResponse;
  try {
    me = await serverApiFetch<MeResponse>("/auth/me");
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof ApiError) {
      redirect("/login");
    }
    throw err;
  }
  if (areaForRole(me.role) !== area) {
    redirect(ROLE_RESYNC_PATH);
  }
  return me;
}
