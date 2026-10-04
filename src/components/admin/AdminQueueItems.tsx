import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, focusRing, formatKina } from "@/lib/utils";
import { formatReviewDate } from "@/lib/application-review";
import { formatPlainDate } from "@/lib/penalties";
import { methodLabel, type RepaymentMethod } from "@/lib/report-repayment";
import { plural } from "@/lib/customer-history";
import { daysWaiting, purposeLabel, waitingLabel } from "@/lib/officer-queues";
import {
  adminApplicationHref,
  adminLoanHref,
  adminRepaymentHref,
  recommendationLabel,
} from "@/lib/admin-queues";
import type { AdminApplicationItem, AdminLoanItem, AdminQueuePage, AdminRepaymentItem } from "@/lib/types";

// Same row anatomy as the Loan Officer queues (QueueItemRow): the whole row
// links into the item's workspace; details stack on narrow screens and the
// dates move to a right-hand column on md+.
function Row({ href, main, side }: { href: string; main: React.ReactNode; side: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className={cn("group flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-neutral-50", focusRing)}>
        <div className="min-w-0 flex-1 md:flex md:items-start md:justify-between md:gap-6">
          <div className="min-w-0">{main}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-600 md:mt-0 md:shrink-0 md:flex-col md:items-end md:text-right">
            {side}
          </div>
        </div>
        <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400 group-hover:text-primary" aria-hidden="true" />
      </Link>
    </li>
  );
}

const titleClass = "text-sm font-medium text-neutral-900";
const detailClass = "mt-1 text-sm text-neutral-600";

function ApplicationRow({ item }: { item: AdminApplicationItem }) {
  const purpose = purposeLabel(item.purpose_category);
  const waiting = waitingLabel(daysWaiting(item.submitted_at));
  const rec = recommendationLabel(item.recommendation);
  const submitted = formatReviewDate(item.submitted_at);
  const approved = formatReviewDate(item.decided_at);
  return (
    <Row
      href={adminApplicationHref(item.id)}
      main={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className={titleClass}>
              #{item.id} · {item.customer_name ?? "Unknown customer"}
            </p>
            {item.status === "awaiting_disbursement" && <Badge variant="success">Approved</Badge>}
          </div>
          <p className={detailClass}>
            {formatKina(item.amount_requested)}
            {item.prime_category ? ` · ${item.prime_category}` : ""}
            {purpose ? ` · ${purpose}` : ""}
          </p>
          {rec && item.status !== "awaiting_disbursement" && (
            <p className="mt-1 text-xs font-medium text-neutral-700">{rec}</p>
          )}
        </>
      }
      side={
        <>
          {submitted && <span>Submitted {submitted}</span>}
          {item.status === "awaiting_disbursement" && approved ? (
            <span className="font-medium text-neutral-700">Approved {approved}</span>
          ) : (
            waiting && <span className="font-medium text-neutral-700">{waiting}</span>
          )}
        </>
      }
    />
  );
}

function LoanRow({ item }: { item: AdminLoanItem }) {
  const due = formatPlainDate(item.due_date);
  const disbursed = formatReviewDate(item.disbursed_at);
  return (
    <Row
      href={adminLoanHref(item.loan_id)}
      main={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className={titleClass}>
              Loan #{item.loan_id} · {item.customer.full_name ?? "Unknown customer"}
            </p>
            {item.days_overdue > 0 && (
              <Badge variant="danger">{plural(item.days_overdue, "day")} overdue</Badge>
            )}
          </div>
          <p className={detailClass}>
            {formatKina(item.outstanding)} owed of {formatKina(item.original_total_due)}
            {item.penalties > 0 ? `, including ${formatKina(item.penalties)} in penalties` : ""}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {formatKina(item.principal)} principal{item.prime_category ? ` · ${item.prime_category}` : ""}
          </p>
        </>
      }
      side={
        <>
          {due && <span className="font-medium text-neutral-700">Due {due}</span>}
          {disbursed && <span>Paid out {disbursed}</span>}
        </>
      }
    />
  );
}

function RepaymentRow({ item }: { item: AdminRepaymentItem }) {
  const paid = formatPlainDate(item.payment_date);
  const reported = formatReviewDate(item.reported_at);
  const receipts = item.receipts.length;
  return (
    <Row
      href={adminRepaymentHref(item.payment_id)}
      main={
        <>
          <p className={titleClass}>
            {formatKina(item.amount_reported)} · Loan #{item.loan_id} · {item.customer?.full_name ?? "Unknown customer"}
          </p>
          <p className={detailClass}>
            {item.payment_method ? methodLabel(item.payment_method as RepaymentMethod) : "Method not given"}
            {item.reference_number ? ` · Ref ${item.reference_number}` : ""}
          </p>
          <p className={cn("mt-0.5 text-xs", receipts ? "text-neutral-600" : "text-amber-800")}>
            {receipts ? plural(receipts, "receipt") : "No receipt attached"}
            {item.loan_outstanding !== null ? ` · Loan balance ${formatKina(item.loan_outstanding)}` : ""}
          </p>
        </>
      }
      side={
        <>
          {paid && <span className="font-medium text-neutral-700">Paid {paid}</span>}
          {reported && <span>Reported {reported}</span>}
        </>
      }
    />
  );
}

// One queue's items, in the backend's order.
export function AdminQueueItems({ page }: { page: AdminQueuePage }) {
  return (
    <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
      {page.kind === "application" && page.items.map((item) => <ApplicationRow key={item.id} item={item} />)}
      {page.kind === "loan" && page.items.map((item) => <LoanRow key={item.loan_id} item={item} />)}
      {page.kind === "repayment" && page.items.map((item) => <RepaymentRow key={item.payment_id} item={item} />)}
    </ul>
  );
}
