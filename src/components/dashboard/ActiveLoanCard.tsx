import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { DashboardKpis, Loan } from "@/lib/types";

interface ActiveLoanCardProps {
  kpis: DashboardKpis;
  hasOverdue: boolean;
  // Optional: the specific Loan record (from GET /loans/mine) to show
  // per-loan details below the existing hero. Kept optional so the hero
  // still renders standalone if a matching loan can't be resolved.
  loan?: Loan;
  // Computed by the caller (Date.now() isn't allowed during a component's
  // render per the react-hooks/purity rule) — the page component computes
  // this fresh per request since the route is already force-dynamic.
  daysRemaining?: number | null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
export function ActiveLoanCard({ kpis, hasOverdue, loan, daysRemaining = null }: ActiveLoanCardProps) {
  const totalPipeline = kpis.amount_repaid + kpis.outstanding_balance;
  const progressPct = totalPipeline > 0 ? Math.min(Math.round((kpis.amount_repaid / totalPipeline) * 100), 100) : 0;

  const nextPayment = kpis.next_payment;
  const nextPaymentAmount = typeof nextPayment?.amount_due === "number" ? formatKina(nextPayment.amount_due) : null;
  const nextPaymentDate =
    typeof nextPayment?.due_date === "string"
      ? new Date(nextPayment.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;

  // "Verified amount paid" is deliberately read only from the loan's own
  // repayment_schedule (staff-recorded installment data) — never from a
  // customer's own self-reported figure. See Report Repayment below: it
  // uploads a receipt for a loan officer to verify, and never writes to
  // amount_paid directly, so this sum stays accurate by construction.
  const verifiedAmountPaid = loan?.repayment_schedule.reduce((sum, item) => sum + item.amount_paid, 0) ?? 0;
  const interestAmount = loan ? loan.total_repayable - loan.principal_amount : 0;
  const nextInstallment = loan?.repayment_schedule.find((item) => item.status !== "paid");

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
          {/* text-neutral-400 measured well below AA contrast at this size
              (confirmed with axe-core: 2.56:1 vs 4.5:1 required) —
              text-neutral-600 passes comfortably. Pre-existing line, fixed
              here since this file is already being adapted this phase and
              the active-loan state is one of the states being re-checked. */}
          <p className="mt-1 text-xs text-neutral-600">
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

      {loan && (
        <div className="mt-6 border-t border-neutral-100 pt-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Loan details</p>
          <div>
            <DetailRow label="Loan ID" value={`#${loan.id}`} />
            <DetailRow label="Amount borrowed" value={formatKina(loan.principal_amount)} />
            <DetailRow label="Interest amount" value={formatKina(interestAmount)} />
            <DetailRow label="Total repayment" value={formatKina(loan.total_repayable)} />
            <DetailRow label="Verified amount paid" value={formatKina(verifiedAmountPaid)} />
            <DetailRow label="Outstanding balance" value={formatKina(kpis.outstanding_balance)} />
            <DetailRow label="Disbursement date" value={formatDate(loan.disbursed_at)} />
            <DetailRow label="Next due date" value={nextInstallment ? formatDate(nextInstallment.due_date) : "—"} />
            <DetailRow
              label="Days remaining"
              value={daysRemaining === null ? "—" : daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days`}
            />
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            Make repayments via BSP Mobile Banking or in person, using your Loan ID (#{loan.id}) as the reference.
          </p>

          <Link
            href={`/dashboard/loans/${loan.id}/report-repayment`}
            className={cn(
              "mt-4 inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-lg bg-primary px-6 text-base font-medium text-white transition-colors hover:bg-primary-dark sm:w-auto",
              focusRing,
            )}
          >
            Report Repayment
          </Link>
        </div>
      )}
    </Card>
  );
}
