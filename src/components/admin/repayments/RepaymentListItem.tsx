import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DocumentViewButton } from "@/components/staff/review/DocumentViewButton";
import { formatReviewDateTime } from "@/lib/application-review";
import { formatPlainDate } from "@/lib/penalties";
import { paymentMethodLabel, paymentStatus } from "@/lib/admin-loans";
import { adminLoanHref, adminRepaymentHref } from "@/lib/admin-queues";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { AdminRepaymentItem } from "@/lib/types";

const linkClass = cn("rounded font-medium text-primary hover:text-primary-dark", focusRing);

// One reported payment in the verification queue. Not a single big link:
// the receipts are their own buttons.
export function RepaymentListItem({ item }: { item: AdminRepaymentItem }) {
  const s = paymentStatus(item.status);
  return (
    <li className="flex flex-col gap-2 px-3 py-4 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={adminRepaymentHref(item.payment_id, item.loan_id)} className={cn("inline-flex min-h-6 items-center text-sm", linkClass)}>
            Payment #{item.payment_id}
          </Link>
          <span className="text-sm text-neutral-600">·</span>
          <Link href={adminLoanHref(item.loan_id)} className={cn("inline-flex min-h-6 items-center text-sm", linkClass)}>
            Loan #{item.loan_id}
          </Link>
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-900">{item.customer?.full_name ?? "Unknown customer"}</p>
        <p className="mt-0.5 text-sm text-neutral-600">
          {paymentMethodLabel(item.payment_method)}
          {item.reference_number ? ` · Ref ${item.reference_number}` : " · No reference"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
          {item.receipts.length === 0 ? (
            <span className="text-amber-800">No receipt attached</span>
          ) : (
            item.receipts.map((r, i) => (
              <DocumentViewButton key={r.id} documentId={r.id} label={item.receipts.length > 1 ? `Receipt ${i + 1}` : "Receipt"} />
            ))
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs md:shrink-0 md:text-right">
        <dt className="text-neutral-600">Reported</dt>
        <dd className="font-display text-base font-bold text-neutral-900">{formatKina(item.amount_reported)}</dd>
        <dt className="text-neutral-600">Paid on</dt>
        <dd className="text-neutral-900">{formatPlainDate(item.payment_date) ?? "Not given"}</dd>
        <dt className="text-neutral-600">Reported at</dt>
        <dd className="text-neutral-900">{formatReviewDateTime(item.reported_at) ?? "—"}</dd>
        <dt className="text-neutral-600">Outstanding now</dt>
        <dd className="text-neutral-900">{item.loan_outstanding !== null ? formatKina(item.loan_outstanding) : "—"}</dd>
      </dl>
    </li>
  );
}
