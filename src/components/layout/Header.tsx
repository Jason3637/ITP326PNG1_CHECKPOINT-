import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/layout/LogoutButton";

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
}

export function Header({ fullName }: HeaderProps) {
  const firstName = fullName.split(" ")[0];

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Small square mark, using the full logo (its own gradient-square
              background) until public/brand/prime-logo-mark-only.png exists —
              that cropped, tagline/gradient-free version will look cleaner
              at this size. <Logo variant="mark"> already falls back
              automatically, no change needed here once it's added. */}
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
            <Logo variant="mark" fill sizes="28px" />
          </div>
          <p className="font-semibold text-neutral-900">
            Hello, <span className="text-primary">{firstName}</span>
          </p>
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
            href="/dashboard"
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
