import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface HeaderProps {
  fullName: string;
  // The signed-in user's own area root - the avatar links back to it.
  homeHref?: string;
  // Staff shell only: makes it obvious at a glance which portal you're in,
  // since both share the same chrome and brand tokens.
  roleLabel?: string;
  // "admin" / "workspace" (the Loan Officer area - same frame): 64px tall,
  // full width with the page's own side padding (so it lines up with the
  // content however wide that is), and the logo left to the sidebar from
  // lg up.
  layout?: "default" | "admin" | "workspace";
  // Before the logo - the workspace menu button below lg.
  menu?: React.ReactNode;
}

export function Header({ fullName, homeHref = "/dashboard", roleLabel, layout = "default", menu }: HeaderProps) {
  const firstName = fullName.split(" ")[0];
  const admin = layout === "admin" || layout === "workspace";

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
      <div
        className={cn(
          "flex items-center justify-between",
          admin ? "h-16 px-4 sm:px-6 lg:px-8 xl:px-10" : "mx-auto h-14 max-w-5xl px-4",
        )}
      >
        <div className="flex items-center gap-2">
          {menu}
          {/* Mark only - the greeting takes the space a wordmark would. The
              mark's image is set in one place (MARK_LOGO_SRC in ui/Logo.tsx);
              nothing here needs to change when it does. */}
          <Logo variant="mark" size="md" className={admin ? "lg:hidden" : undefined} />
          {/* The only h1 in the authenticated dashboard shell — every
              dashboard page previously had none at all (confirmed with
              axe-core's page-has-heading-one rule), a pre-existing gap
              across the whole section, not just the pages changed this
              phase. Tailwind's preflight resets default heading
              margins/sizes, so this looks identical to the <p> it replaces. */}
          <h1 className="font-semibold text-neutral-900">
            Hello, <span className="text-primary">{firstName}</span>
          </h1>
          {/* Hidden on phones: at 375px it wrapped onto two lines and pushed
              the greeting onto two as well (checked visually). The staff
              nav and page content already make the portal obvious there. */}
          {roleLabel && (
            <Badge variant="primary" className="hidden whitespace-nowrap sm:inline-flex">
              {roleLabel}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>

          <Link
            href={homeHref}
            aria-label="Profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {getInitials(fullName)}
          </Link>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
