import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { DashboardKpis } from "@/lib/types";

interface ActiveLoanCardProps {
  kpis: DashboardKpis;
  hasOverdue: boolean;
}

// This is the dashboard's hero card (promoted from the removed savings
// chart, then re-promoted from mock loan data to the real backend), so it
// keeps the one sparing gradient accent.
//
// Driven by GET /api/reports/dashboard's kpis - outstanding_balance and
// amount_repaid are both real, verified fields (checked live against the
// deployed backend). kpis.next_payment is documented only as a generic
// object in the OpenAPI spec and was never observed populated (that
// requires a loan_officer account to approve an application into an
// active loan, which this project has no credentials for) - rendered
// defensively below.
export function ActiveLoanCard({ kpis, hasOverdue }: ActiveLoanCardProps) {
  const totalPipeline = kpis.amount_repaid + kpis.outstanding_balance;
  const progressPct = totalPipeline > 0 ? Math.min(Math.round((kpis.amount_repaid / totalPipeline) * 100), 100) : 0;

  const nextPayment = kpis.next_payment;
  const nextPaymentAmount = typeof nextPayment?.amount_due === "number" ? formatKina(nextPayment.amount_due) : null;
  const nextPaymentDate =
    typeof nextPayment?.due_date === "string"
      ? new Date(nextPayment.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;

  return (
    <Card className="animate-card-enter relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />

      <CardHeader>
        <CardTitle>Active loan{kpis.active_loans > 1 ? "s" : ""}</CardTitle>
        <Badge variant={hasOverdue ? "danger" : "success"}>{hasOverdue ? "Overdue" : "Active"}</Badge>
      </CardHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <p className="font-accent text-sm text-neutral-500">Outstanding balance</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {formatKina(kpis.outstanding_balance)}
          </p>
        </div>

        <div>
          <p className="text-sm text-neutral-500">Next repayment</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">
            {nextPaymentAmount && nextPaymentDate
              ? `${nextPaymentAmount} due ${nextPaymentDate}`
              : "No upcoming payment on file"}
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
            {formatKina(kpis.amount_repaid)} of {formatKina(totalPipeline)} repaid
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/repayment-history"
        className={cn("mt-6 inline-block rounded text-sm font-medium text-primary hover:underline", focusRing)}
      >
        View repayment history
      </Link>
    </Card>
  );
}
