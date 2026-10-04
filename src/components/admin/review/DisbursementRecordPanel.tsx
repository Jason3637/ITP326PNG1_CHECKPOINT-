import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DetailList, DetailRow } from "@/components/staff/review/DetailList";
import { DocumentViewButton } from "@/components/staff/review/DocumentViewButton";
import { formatReviewDateTime } from "@/lib/application-review";
import { DISBURSEMENT_COPY } from "@/lib/disbursement";
import { formatPlainDate } from "@/lib/penalties";
import { adminLoanHref } from "@/lib/admin-queues";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { AdminLoanDetail, LoanStatus } from "@/lib/types";

// The loan's own status from GET /admin/loans/<id> - "Loan Active" is only
// ever shown when the backend says the loan is active.
export function loanStatusBadge(status: LoanStatus): { label: string; variant: "success" | "danger" | "neutral" } {
  if (status === "active") return { label: "Loan Active", variant: "success" };
  if (status === "overdue") return { label: "Loan Overdue", variant: "danger" };
  return { label: "Loan Closed", variant: "neutral" };
}

// What was recorded, read back from the backend after the save.
export function DisbursementRecordPanel({ loan }: { loan: AdminLoanDetail }) {
  const d = loan.disbursement;
  const badge = loanStatusBadge(loan.status);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Disbursement</CardTitle>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      {d ? (
        <DetailList className="mt-3">
          <DetailRow label="Paid out" value={formatKina(d.amount)} />
          <DetailRow label="Method" value={DISBURSEMENT_COPY.methods[d.method]?.label ?? null} />
          {d.destination_masked && <DetailRow label="Paid to" value={d.destination_masked} />}
          <DetailRow
            label={DISBURSEMENT_COPY.methods[d.method]?.referenceLabel ?? "Reference"}
            value={d.reference}
          />
          <DetailRow label="Money moved" value={formatReviewDateTime(d.disbursed_at)} />
          <DetailRow
            label="Recorded"
            value={formatReviewDateTime(d.recorded_at)}
            hint={d.recorded_by_name ? `by ${d.recorded_by_name}` : undefined}
          />
          <DetailRow
            label="Evidence"
            value={d.evidence_document_id !== null ? <DocumentViewButton documentId={d.evidence_document_id} /> : "None attached"}
          />
          {d.note && <DetailRow label="Note" value={d.note} />}
          <DetailRow label="Customer repays" value={formatKina(loan.terms.original_total_due)} />
          <DetailRow label="Due" value={formatPlainDate(loan.terms.due_date)} />
        </DetailList>
      ) : (
        <p className="mt-2 text-sm text-neutral-600">No disbursement record was returned for this loan.</p>
      )}
      <Link
        href={adminLoanHref(loan.loan_id)}
        className={cn("mt-4 inline-block rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing)}
      >
        Open loan #{loan.loan_id}
      </Link>
    </Card>
  );
}
