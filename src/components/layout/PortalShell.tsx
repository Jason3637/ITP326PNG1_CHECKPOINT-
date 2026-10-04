import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import type { NavVariant } from "@/lib/nav";

interface PortalShellProps {
  variant: NavVariant;
  fullName: string;
  homeHref?: string;
  roleLabel?: string;
  children: React.ReactNode;
}

// The chrome every area shares - same header, sidebar and phone bottom bar;
// only the nav set (variant), home link and role badge differ.
export function PortalShell({ variant, fullName, homeHref, roleLabel, children }: PortalShellProps) {
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
