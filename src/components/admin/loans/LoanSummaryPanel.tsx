import { Card, CardTitle } from "@/components/ui/Card";
import { DetailList, DetailRow } from "@/components/staff/review/DetailList";
import { formatReviewDateTime } from "@/lib/application-review";
import { formatPlainDate } from "@/lib/penalties";
import { plural } from "@/lib/customer-history";
import { formatKina } from "@/lib/utils";
import type { AdminLoanDetail } from "@/lib/types";

function formatRate(rate: number): string {
  return `${Math.round(rate * 10000) / 100}%`;
}

// Every figure is the backend's: terms from the loan's terms snapshot,
// money owed and paid from the ledger (GET /admin/loans/<id>).
export function LoanSummaryPanel({ loan }: { loan: AdminLoanDetail }) {
  const { terms: t, balance: b } = loan;
  return (
    <Card>
      <CardTitle>Loan</CardTitle>
      <DetailList className="mt-3">
        <DetailRow label="Loan ID" value={`#${loan.loan_id}`} hint={`From application #${loan.application_id}`} />
        <DetailRow label="Customer" value={loan.customer.full_name} hint={loan.customer.email ?? undefined} />
        <DetailRow label="Principal" value={formatKina(t.principal)} />
        <DetailRow label="PRIME category" value={t.prime_category} />
        <DetailRow
          label="Interest"
          value={formatKina(t.interest_amount)}
          hint={`${formatRate(t.interest_rate)} flat for the ${t.term_days}-day term`}
        />
        <DetailRow label="Original amount due" value={formatKina(t.original_total_due)} />
      </DetailList>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Balance (from the ledger)</h3>
      <DetailList className="mt-1">
        <DetailRow label="Verified payments" value={formatKina(b.verified_repayments)} />
        <DetailRow label="Penalties" value={formatKina(b.penalties)} />
        <DetailRow label="Outstanding balance" value={<span className="font-semibold">{formatKina(b.outstanding)}</span>} />
      </DetailList>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Dates</h3>
      <DetailList className="mt-1">
        <DetailRow label="Disbursed" value={formatReviewDateTime(t.disbursed_at)} />
        <DetailRow label="Due" value={formatPlainDate(t.due_date)} />
        {b.days_overdue > 0 && (
          <DetailRow label="Days overdue" value={<span className="font-semibold text-red-700">{plural(b.days_overdue, "day")}</span>} />
        )}
      </DetailList>
    </Card>
  );
}
