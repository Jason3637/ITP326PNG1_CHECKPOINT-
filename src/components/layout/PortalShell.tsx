import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { AdminNavDrawer } from "./AdminNavDrawer";
import type { AdminNavCounts, NavVariant } from "@/lib/nav";

interface PortalShellProps {
  variant: NavVariant;
  fullName: string;
  homeHref?: string;
  roleLabel?: string;
  // Admin only: queue counts for the nav (null if they couldn't be read).
  adminCounts?: AdminNavCounts | null;
  children: React.ReactNode;
}

// The chrome every area shares - same header, sidebar and phone bottom bar;
// only the nav set (variant), home link and role badge differ. The admin
// area has its own desktop-first frame, below.
export function PortalShell({ variant, fullName, homeHref, roleLabel, adminCounts = null, children }: PortalShellProps) {
  if (variant === "admin") {
    return (
      <AdminFrame fullName={fullName} homeHref={homeHref} roleLabel={roleLabel} counts={adminCounts}>
        {children}
      </AdminFrame>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar variant={variant} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header fullName={fullName} homeHref={homeHref} roleLabel={roleLabel} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-6">{children}</main>
        <BottomNav variant={variant} />
      </div>
    </div>
  );
}

// The Administrator frame. A 240px grouped sidebar from lg (1024px) up;
// below that, the same nav in a drawer from the header's menu button (no
// bottom bar - eleven destinations don't fit one). Content is up to 1280px
// wide with 32-40px side padding on desktop; a page that needs more room
// (the audit log) marks its root data-page-width="wide" for 1440px. Buttons
// and fields inside use the comfortable 44px density (globals.css).
function AdminFrame({
  fullName,
  homeHref,
  roleLabel,
  counts,
  children,
}: {
  fullName: string;
  homeHref?: string;
  roleLabel?: string;
  counts: AdminNavCounts | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar variant="admin" adminCounts={counts} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          fullName={fullName}
          homeHref={homeHref}
          roleLabel={roleLabel}
          layout="admin"
          menu={<AdminNavDrawer counts={counts} />}
        />
        <main data-density="comfortable" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
          <div className="mx-auto w-full max-w-7xl has-[[data-page-width=wide]]:max-w-360">{children}</div>
        </main>
      </div>
    </div>
  );
}
