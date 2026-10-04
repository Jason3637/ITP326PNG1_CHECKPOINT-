import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { DetailList, DetailRow } from "@/components/staff/review/DetailList";
import { DocumentViewButton } from "@/components/staff/review/DocumentViewButton";
import { RepaymentDecisionPanel } from "@/components/admin/repayments/RepaymentDecisionPanel";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import { formatReviewDateTime } from "@/lib/application-review";
import { adminLoanStatus, paymentMethodLabel, paymentStatus } from "@/lib/admin-loans";
import { adminLoanHref, adminRepaymentsHref } from "@/lib/admin-queues";
import { formatPlainDate } from "@/lib/penalties";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { AdminLoanDetail } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ loanId: string; paymentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// The Repayment Verification workspace for one reported payment. Read from
// its loan (GET /admin/loans/<loanId>) - the backend has no single-payment
// endpoint - so the payment, the loan's current outstanding and its status
// all come from one consistent read. A payment that isn't on that loan 404s.
export default async function AdminRepaymentPage({ params, searchParams }: PageProps) {
  const { loanId, paymentId } = await params;
  if (!/^\d+$/.test(loanId) || !/^\d+$/.test(paymentId)) notFound();
  const doneRaw = (await searchParams).done;
  const done = doneRaw === "verified" || doneRaw === "rejected" ? doneRaw : null;

  let loan: AdminLoanDetail;
  try {
    loan = await serverApiFetch<AdminLoanDetail>(`/admin/loans/${loanId}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const payment = loan.payments.find((p) => p.id === Number(paymentId));
  if (!payment) notFound();

  const s = paymentStatus(payment.status);
  const loanStatus = adminLoanStatus(loan);
  // Banners only when the backend's state backs them up.
  const showVerified = done === "verified" && payment.status === "verified";
  const showRejected = done === "rejected" && payment.status === "rejected";

  return (
    <div className="flex flex-col gap-4">
      <Link href={adminRepaymentsHref()} className={cn("inline-flex w-fit items-center gap-1", linkClass)}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to repayments
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Payment #{payment.id} · {loan.customer.full_name ?? "Unknown customer"}
        </h2>
        <Badge variant={s.variant} className="w-fit">
          {s.label}
        </Badge>
      </div>

      {showVerified && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-light p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-neutral-900">Payment verified</p>
            <p className="mt-0.5 text-neutral-700">
              {loan.status === "closed"
                ? `Loan #${loan.loan_id} is paid in full and closed.`
                : `Loan #${loan.loan_id} now has ${formatKina(loan.balance.outstanding)} outstanding.`}
            </p>
          </div>
        </div>
      )}
      {showRejected && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-neutral-900">Payment rejected</p>
            <p className="mt-0.5 text-neutral-700">Nothing was added to the ledger. The balance is unchanged.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardTitle>Reported payment</CardTitle>
          <DetailList className="mt-3">
            <DetailRow label="Payment ID" value={`#${payment.id}`} />
            <DetailRow
              label="Loan ID"
              value={
                <Link href={adminLoanHref(loan.loan_id)} className={linkClass}>
                  #{loan.loan_id}
                </Link>
              }
            />
            <DetailRow label="Customer" value={loan.customer.full_name} hint={loan.customer.email ?? undefined} />
            <DetailRow label="Amount reported" value={<span className="font-semibold">{formatKina(payment.amount)}</span>} />
            <DetailRow label="Payment date" value={formatPlainDate(payment.payment_date) ?? "Not given"} />
            <DetailRow label="Method" value={paymentMethodLabel(payment.payment_method)} />
            <DetailRow label="Reference" value={payment.reference_number ?? "Not given"} />
            <DetailRow label="Reported" value={formatReviewDateTime(payment.reported_at)} />
            <DetailRow
              label="Receipt"
              value={
                payment.receipts.length === 0 ? (
                  <span className="text-amber-800">None attached</span>
                ) : (
                  <span className="flex flex-col items-end gap-1">
                    {payment.receipts.map((r, i) => (
                      <DocumentViewButton key={r.id} documentId={r.id} label={payment.receipts.length > 1 ? `View receipt ${i + 1}` : "View receipt"} />
                    ))}
                  </span>
                )
              }
            />
            {payment.status === "verified" && <DetailRow label="Verified" value={formatReviewDateTime(payment.paid_at)} />}
            {payment.status === "rejected" && <DetailRow label="Rejection reason" value={payment.rejection_reason} />}
          </DetailList>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">The loan now</h3>
          <DetailList className="mt-1">
            <DetailRow label="Status" value={loanStatus.label} />
            <DetailRow label="Outstanding balance" value={formatKina(loan.balance.outstanding)} />
            <DetailRow label="Due" value={formatPlainDate(loan.terms.due_date)} />
          </DetailList>
        </Card>

        <RepaymentDecisionPanel
          paymentId={payment.id}
          loanId={loan.loan_id}
          status={payment.status}
          amount={payment.amount}
          outstanding={loan.balance.outstanding}
        />
      </div>
    </div>
  );
}
