import { PortalShell } from "@/components/layout/PortalShell";
import { requireAreaUser } from "@/lib/portal-guard";

// Every page under (dashboard) reads the session cookie and calls the
// backend per-request - never statically prerenderable. Stated explicitly
// rather than relying on Next.js's implicit "calling cookies() opts a page
// out of static rendering" detection: that inference only kicks in once
// the dynamic API is actually reached, so an error thrown earlier in the
// same request (e.g. a missing env var) can still crash the build instead
// of gracefully deferring to a runtime error - confirmed by a real Vercel
// build failure, not a hypothetical.
export const dynamic = "force-dynamic";

// Defense-in-depth alongside src/proxy.ts: proxy only checks that a
// session cookie exists; requireAreaUser is the authoritative check (it
// also handles the transparent access-token refresh) and fetches the
// signed-in member's name for the header. Loan officers and admins are
// sent to their own areas.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAreaUser("customer");
  return (
    <PortalShell variant="customer" fullName={me.full_name}>
      {children}
    </PortalShell>
  );
}
