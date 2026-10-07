import { PortalShell } from "@/components/layout/PortalShell";
import { requireAreaUser } from "@/lib/portal-guard";
import { officerNavCounts } from "@/lib/officer-queue-counts";
import { STAFF_HOME, roleLabel } from "@/lib/roles";

// See (dashboard)/layout.tsx - same reasons, every staff page is per-request.
export const dynamic = "force-dynamic";

// The Loan Officer area. Same login and session cookies as the other two
// areas, in the desktop-first workspace frame (PortalShell's staff variant)
// with each queue's total in the nav. Loan officers only: customers and
// admins are sent to their own areas (see requireAreaUser).
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const [me, counts] = await Promise.all([requireAreaUser("officer"), officerNavCounts()]);
  return (
    <PortalShell
      variant="staff"
      fullName={me.full_name}
      homeHref={STAFF_HOME}
      roleLabel={roleLabel(me.role)}
      officerCounts={counts}
    >
      {children}
    </PortalShell>
  );
}
