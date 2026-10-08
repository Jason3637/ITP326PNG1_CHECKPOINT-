import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { cn, focusRing } from "@/lib/utils";

// There's no self-service password reset yet - the backend only lets an
// administrator reset a password. This page is where the login page's
// "Forgot password?" link lands until that exists.
export default function ForgotPasswordPage() {
  return (
    <Card className="sm:p-8">
      <Logo size="lg" tagline="Your Financial Assistant" />

      <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-neutral-900">Forgot your password?</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Passwords are reset by PRIMESTONE staff. Contact PRIMESTONE and ask for a password reset.
      </p>

      <p className="mt-6 text-center text-sm text-neutral-500">
        <Link href="/login" className={cn("rounded font-medium text-primary hover:underline", focusRing)}>
          Back to log in
        </Link>
      </p>
    </Card>
  );
}
