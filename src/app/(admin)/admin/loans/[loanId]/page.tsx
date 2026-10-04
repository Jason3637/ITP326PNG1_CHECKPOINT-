import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { DetailList, DetailRow } from "@/components/staff/review/DetailList";
import { LoanSummaryPanel } from "@/components/admin/loans/LoanSummaryPanel";
import { LedgerPanel } from "@/components/admin/loans/LedgerPanel";
import { PaymentHistoryPanel } from "@/components/admin/loans/PaymentHistoryPanel";
import { AuditHistoryPanel } from "@/components/admin/loans/AuditHistoryPanel";
import { DisbursementRecordPanel } from "@/components/admin/review/DisbursementRecordPanel";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import { formatReviewDateTime } from "@/lib/application-review";
import { adminLoanStatus } from "@/lib/admin-loans";
import { formatPlainDate } from "@/lib/penalties";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { AdminLoanDetail } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ loanId: string }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// The loan as the backend records it (GET /admin/loans/<id>): terms from the
// terms snapshot, every amount owed or paid from the ledger, the payments
// reported against it and the audit trail. Nothing is editable here.
export default async function AdminLoanPage({ params }: PageProps) {
  const { loanId } = await params;
  if (!/^\d+$/.test(loanId)) notFound();

  let loan: AdminLoanDetail;
  try {
    loan = await serverApiFetch<AdminLoanDetail>(`/admin/loans/${loanId}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const status = adminLoanStatus(loan);
  const awaiting = loan.payments.filter((p) => p.status === "reported" || p.status === "verification_pending").length;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className={cn("inline-flex w-fit items-center gap-1", linkClass)}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Loan #{loan.loan_id} · {loan.customer.full_name ?? "Unknown customer"}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            <Link href={`/admin/applications/${loan.application_id}`} className={linkClass}>
              Application #{loan.application_id}
            </Link>
            {awaiting > 0 ? ` · ${awaiting} payment${awaiting === 1 ? "" : "s"} awaiting verification` : ""}
          </p>
        </div>
        <Badge variant={status.variant} className="w-fit">
          {status.label}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <LoanSummaryPanel loan={loan} />
          {loan.closure && (
            <Card>
              <CardTitle>Closure</CardTitle>
              <DetailList className="mt-3">
                <DetailRow label="Closed" value={formatReviewDateTime(loan.closure.closed_at)} />
                <DetailRow label="Reason" value={loan.closure.closure_reason === "defaulted" ? "Written off" : "Paid in full"} />
                <DetailRow label="Verified payments" value={formatKina(loan.closure.total_verified_paid)} />
                <DetailRow label="Penalties" value={formatKina(loan.closure.total_penalties)} />
                <DetailRow label="Outstanding at closure" value={formatKina(loan.closure.outstanding_at_closure)} />
                {loan.closure.final_payment_date && (
                  <DetailRow label="Final payment" value={formatPlainDate(loan.closure.final_payment_date)} />
                )}
              </DetailList>
            </Card>
          )}
          {loan.disbursement && <DisbursementRecordPanel loan={loan} showLoanLink={false} />}
        </div>
        <div className="flex flex-col gap-4">
          <LedgerPanel entries={loan.ledger} outstanding={loan.balance.outstanding} />
          <PaymentHistoryPanel loanId={loan.loan_id} payments={loan.payments} />
        </div>
      </div>

      <AuditHistoryPanel entries={loan.audit_history} />
    </div>
  );
}
