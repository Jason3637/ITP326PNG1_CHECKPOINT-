import { PortalShell } from "@/components/layout/PortalShell";
import { requireAreaUser } from "@/lib/portal-guard";
import { serverApiFetch } from "@/lib/server-api";
import { ADMIN_HOME, roleLabel } from "@/lib/roles";
import type { AdminNavCounts } from "@/lib/nav";
import type { AdminQueue, AdminQueueCounts } from "@/lib/types";

// See (dashboard)/layout.tsx - same reasons, every admin page is per-request.
export const dynamic = "force-dynamic";

// The sidebar's queue counts, from the same GET /admin/queues the dashboard
// uses. Optional: if it fails the nav shows no counts rather than taking
// the page down (the page's own reads report their own errors). A layout
// doesn't re-render on navigation, but it does on router.refresh(), which
// every admin action calls after it saves - so counts follow the
// administrator's own changes; others' show on the next full load.
async function navCounts(): Promise<AdminNavCounts | null> {
  try {
    const { queues } = await serverApiFetch<AdminQueueCounts>("/admin/queues");
    return Object.fromEntries(
      (Object.entries(queues) as [AdminQueue, { count: number }][]).map(([key, q]) => [key, q.count]),
    ) as AdminNavCounts;
  } catch {
    return null;
  }
}

// The Administrator area. Same login and session cookies as the other two
// areas, with its own desktop-first frame (PortalShell's admin variant).
// Admins only: customers and loan officers are sent to their own areas (see
// requireAreaUser), and every /api/admin endpoint rejects their tokens
// anyway.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [me, counts] = await Promise.all([requireAreaUser("admin"), navCounts()]);
  return (
    <PortalShell
      variant="admin"
      fullName={me.full_name}
      homeHref={ADMIN_HOME}
      roleLabel={roleLabel(me.role)}
      adminCounts={counts}
    >
      {children}
    </PortalShell>
  );
}
