import Link from "next/link";
import { Bell } from "lucide-react";
import { mockMember } from "@/lib/mock-data";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Header() {
  const firstName = mockMember.name.split(" ")[0];

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <p className="font-semibold text-neutral-900">
          Hello, <span className="text-primary">{firstName}</span>
        </p>

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
            {getInitials(mockMember.name)}
          </Link>
        </div>
      </div>
    </header>
  );
}
