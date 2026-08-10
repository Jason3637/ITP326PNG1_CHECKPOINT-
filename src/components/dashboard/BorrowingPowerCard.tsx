import Link from "next/link";
import { HandCoins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn, focusRing, formatKina } from "@/lib/utils";

interface BorrowingPowerCardProps {
  maxLoanAmount: number;
}

// Dashboard hero when the member has no active loan. Replaces the old
// savings-derived "eligible based on your savings history" prompt —
// Prime's Vault is lending-only, so eligibility now comes from
// Member.maxLoanAmount (the income-multiplier model from Phase L1).
export function BorrowingPowerCard({ maxLoanAmount }: BorrowingPowerCardProps) {
  return (
    <Card className="animate-card-enter relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
            <HandCoins className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-accent text-sm text-neutral-500">Borrowing power</p>
            <p className="font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Up to {formatKina(maxLoanAmount)}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Based on your verified monthly income, you&apos;re eligible to apply.
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
