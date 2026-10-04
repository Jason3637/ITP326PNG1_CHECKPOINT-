import { PortalShell } from "@/components/layout/PortalShell";
import { requireAreaUser } from "@/lib/portal-guard";
import { STAFF_HOME, roleLabel } from "@/lib/roles";

// See (dashboard)/layout.tsx - same reasons, every staff page is per-request.
export const dynamic = "force-dynamic";

// The Loan Officer area. Same login, session cookies and chrome as the
// member dashboard - only the nav set and the role badge differ. Loan
// officers only: customers and admins are sent to their own areas (see
// requireAreaUser).
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAreaUser("officer");
  return (
    <PortalShell variant="staff" fullName={me.full_name} homeHref={STAFF_HOME} roleLabel={roleLabel(me.role)}>
      {children}
    </PortalShell>
  );
}
