import Link from "next/link";
import { HandCoins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/lib/utils";

// Dashboard hero when the member has no active loan.
//
// The mock-data era showed a specific "eligible up to $X" figure derived
// from a fabricated maxLoanAmount field. The real backend has no
// equivalent: GET /api/admin/parameters (where a program-wide loan cap
// would live) is confirmed admin-only (403 for a customer token, checked
// live), and eligibility itself - credit_evaluation_result.max_eligible_
// amount - only gets computed as part of submitting an application, not
// before. Rather than invent a number the backend doesn't expose, this
// card just prompts the member to apply, honestly.
export function BorrowingPowerCard() {
  return (
    <Card className="animate-card-enter relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
            <HandCoins className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-accent text-sm text-neutral-500">No active loan</p>
            <p className="font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Ready to apply?
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Submit an application and we&apos;ll review it against your account standing and repayment history.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/loans/apply"
          className={cn(
            "inline-flex h-10 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-primary px-5 text-sm font-medium text-white transition-colors hover:bg-primary-dark sm:w-auto",
            focusRing,
          )}
        >
          Apply for a Loan
        </Link>
      </div>
    </Card>
  );
}
