import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { mockTransactions } from "@/lib/mock-data";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { Loan } from "@/lib/types";

interface ActiveLoanCardProps {
  loan: Loan;
}

// No repayment schedule exists yet, so "next repayment" is a projected
// placeholder (the 1st of next month) rather than data from the mock loan.
function nextRepaymentDate() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function ActiveLoanCard({ loan }: ActiveLoanCardProps) {
  const amountPaid = mockTransactions
    .filter((txn) => txn.type === "repayment")
    .reduce((sum, txn) => sum + txn.amount, 0);
  const outstandingBalance = Math.max(loan.totalRepayable - amountPaid, 0);
  const progressPct = Math.min(Math.round((amountPaid / loan.totalRepayable) * 100), 100);

  return (
    // This is now the dashboard's hero card (promoted from the removed
    // savings chart), so it keeps the one sparing gradient accent.
    <Card className="animate-card-enter relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />

      <CardHeader>
        <CardTitle>Active loan</CardTitle>
        <Badge variant="success">Active</Badge>
      </CardHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <p className="font-accent text-sm text-neutral-500">Outstanding balance</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {formatKina(outstandingBalance)}
          </p>
        </div>

        <div>
          <p className="text-sm text-neutral-500">Next repayment</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">
            {formatKina(loan.monthlyPayment)} due {nextRepaymentDate()}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Paid off</span>
            <span className="font-medium text-neutral-900">{progressPct}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Loan repayment progress"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {formatKina(amountPaid)} of {formatKina(loan.totalRepayable)} repaid
          </p>
        </div>
      </div>

      <Link
        href={`/dashboard/loans/${loan.id}/schedule`}
        className={cn("mt-6 inline-block rounded text-sm font-medium text-primary hover:underline", focusRing)}
      >
        View full repayment schedule
      </Link>
    </Card>
  );
}
