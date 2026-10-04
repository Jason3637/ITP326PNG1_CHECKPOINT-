import { PortalShell } from "@/components/layout/PortalShell";
import { requireAreaUser } from "@/lib/portal-guard";
import { ADMIN_HOME, roleLabel } from "@/lib/roles";

// See (dashboard)/layout.tsx - same reasons, every admin page is per-request.
export const dynamic = "force-dynamic";

// The Administrator area. Same login, session cookies and chrome as the
// other two areas - only the nav set and the role badge differ. Admins
// only: customers and loan officers are sent to their own areas (see
// requireAreaUser), and every /api/admin endpoint rejects their tokens
// anyway.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAreaUser("admin");
  return (
    <PortalShell variant="admin" fullName={me.full_name} homeHref={ADMIN_HOME} roleLabel={roleLabel(me.role)}>
      {children}
    </PortalShell>
  );
}
