import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { AdminNavDrawer } from "./AdminNavDrawer";
import { OfficerNavDrawer } from "./OfficerNav";
import type { AdminNavCounts, NavVariant, OfficerNavCounts } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface PortalShellProps {
  variant: NavVariant;
  fullName: string;
  homeHref?: string;
  roleLabel?: string;
  // Admin only: queue counts for the nav (null if they couldn't be read).
  adminCounts?: AdminNavCounts | null;
  // Loan Officer only: queue totals for the nav (null if they couldn't be read).
  officerCounts?: OfficerNavCounts | null;
  children: React.ReactNode;
}

// The chrome every area shares - same header and brand; the nav set
// (variant), home link and role badge differ. The customer area has the
// sidebar and phone bottom bar below; the Administrator and Loan Officer
// areas have the desktop-first workspace frame.
export function PortalShell({
  variant,
  fullName,
  homeHref,
  roleLabel,
  adminCounts = null,
  officerCounts = null,
  children,
}: PortalShellProps) {
  if (variant === "admin") {
    return (
      <WorkspaceFrame
        fullName={fullName}
        homeHref={homeHref}
        roleLabel={roleLabel}
        headerLayout="admin"
        sidebar={<Sidebar variant="admin" adminCounts={adminCounts} />}
        menu={<AdminNavDrawer counts={adminCounts} />}
        density="comfortable"
      >
        {children}
      </WorkspaceFrame>
    );
  }

  if (variant === "staff") {
    return (
      <WorkspaceFrame
        fullName={fullName}
        homeHref={homeHref}
        roleLabel={roleLabel}
        headerLayout="workspace"
        sidebar={<Sidebar variant="staff" officerCounts={officerCounts} />}
        menu={<OfficerNavDrawer counts={officerCounts} />}
        skipLink
        touchTargets
      >
        {children}
      </WorkspaceFrame>
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

const MAIN_ID = "main-content";

// The Administrator and Loan Officer frame. A 240px sticky sidebar from lg
// (1024px) up; below that, the same nav in a drawer from the header's menu
// button (no bottom bar - the destinations don't fit one). Side padding is
// 16/24px on small screens and 32/40px on desktop.
//
// Content width is the page's choice, not a fixed narrow column: up to
// 1280px by default (a review workspace), or 1440px when the page marks its
// root data-page-width="wide" (queues, overviews, the audit log).
//
// density="comfortable" makes buttons and fields inside 44px (globals.css) -
// the admin area's choice; the officer pages keep their own sizes until
// they're redesigned. skipLink adds a "Skip to content" link as the first
// thing to tab to, and makes <main> its target. touchTargets makes every
// control in the frame at least 44px on a touch screen (globals.css).
function WorkspaceFrame({
  fullName,
  homeHref,
  roleLabel,
  headerLayout,
  sidebar,
  menu,
  density,
  skipLink = false,
  touchTargets = false,
  children,
}: {
  fullName: string;
  homeHref?: string;
  roleLabel?: string;
  headerLayout: "admin" | "workspace";
  sidebar: React.ReactNode;
  menu: React.ReactNode;
  density?: "comfortable";
  skipLink?: boolean;
  touchTargets?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-50" data-touch-targets={touchTargets || undefined}>
      {skipLink && (
        <a
          href={`#${MAIN_ID}`}
          // Parked above the viewport (still read by screen readers) and
          // slid into view when focused.
          className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-white px-4 py-2 text-sm font-medium text-primary-dark shadow-lg focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Skip to content
        </a>
      )}
      {sidebar}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header fullName={fullName} homeHref={homeHref} roleLabel={roleLabel} layout={headerLayout} menu={menu} />
        <main
          id={skipLink ? MAIN_ID : undefined}
          tabIndex={skipLink ? -1 : undefined}
          data-density={density}
          className={cn("flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10", skipLink && "focus:outline-none")}
        >
          <div className="mx-auto w-full max-w-7xl has-[[data-page-width=wide]]:max-w-360">{children}</div>
        </main>
      </div>
    </div>
  );
}
