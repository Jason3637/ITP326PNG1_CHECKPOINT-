import Link from "next/link";
import { Wallet } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
          <Wallet className="h-5 w-5" aria-hidden="true" />
          <span>Prime&apos;s Vault</span>
        </Link>
      </div>
    </header>
  );
}
