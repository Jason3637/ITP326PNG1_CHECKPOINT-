import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { serverApiFetch, UnauthenticatedError, ApiError } from "@/lib/server-api";
import { ROLE_RESYNC_PATH, STAFF_HOME, isStaffRole, roleLabel } from "@/lib/roles";
import type { MeResponse } from "@/lib/types";

// See (dashboard)/layout.tsx - same reasons, every staff page is per-request.
export const dynamic = "force-dynamic";

// The staff (loan_officer/admin) portal shell. Same login, same session
// cookies and same chrome components as the member dashboard - only the
// nav set and the role badge differ.
//
// The role check here reads /auth/me (the backend's answer, not the
// pv_role cookie src/proxy.ts uses), so it's the authoritative routing
// decision on the frontend. It is still NOT the security boundary: the
// backend rejects a non-staff token on every staff endpoint regardless of
// what this layout renders.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  let me: MeResponse;
  try {
    me = await serverApiFetch<MeResponse>("/auth/me");
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof ApiError) {
      redirect("/login");
    }
    throw err;
  }

  // Via the re-sync route, not straight to /dashboard - see
  // (dashboard)/layout.tsx.
  if (!isStaffRole(me.role)) {
    redirect(ROLE_RESYNC_PATH);
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar variant="staff" />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header fullName={me.full_name} homeHref={STAFF_HOME} roleLabel={roleLabel(me.role)} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-6">{children}</main>
        <BottomNav variant="staff" />
      </div>
    </div>
  );
}
