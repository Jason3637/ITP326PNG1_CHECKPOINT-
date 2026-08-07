import Link from "next/link";
import { Wallet } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary-light via-white to-neutral-50 px-4 py-12">
      <Link href="/" className="mb-8 flex flex-col items-center gap-1">
        <span className="flex items-center gap-2 text-xl font-bold text-primary">
          <Wallet className="h-6 w-6" aria-hidden="true" />
          Prime&apos;s Vault
        </span>
        <span className="text-sm text-neutral-500">Member savings &amp; loans, simplified</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
