import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatReviewDateTime } from "@/lib/application-review";
import { formatPlainDate } from "@/lib/penalties";
import { paymentMethodLabel, paymentStatus } from "@/lib/admin-loans";
import { adminRepaymentHref } from "@/lib/admin-queues";
import { plural } from "@/lib/customer-history";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { AdminLoanPayment } from "@/lib/types";

// Every payment the customer reported on this loan, newest first, whatever
// its status. Each opens its verification workspace.
export function PaymentHistoryPanel({ loanId, payments }: { loanId: number; payments: AdminLoanPayment[] }) {
  const ordered = [...payments].sort((a, b) => b.id - a.id);
  return (
    <Card className="px-2 sm:px-5">
      <CardTitle className="px-3 sm:px-0">Payment history</CardTitle>
      {ordered.length === 0 ? (
        <p className="mt-2 px-3 text-sm text-neutral-600 sm:px-0">No payments reported yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
          {ordered.map((p) => {
            const s = paymentStatus(p.status);
            return (
              <li key={p.id}>
                <Link
                  href={adminRepaymentHref(p.id, loanId)}
                  className={cn("group flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-neutral-50", focusRing)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-neutral-900">
                        Payment #{p.id} · {formatKina(p.amount)}
                      </p>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {paymentMethodLabel(p.payment_method)}
                      {p.reference_number ? ` · Ref ${p.reference_number}` : ""}
                      {` · ${p.receipts.length ? plural(p.receipts.length, "receipt") : "no receipt"}`}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {p.payment_date ? `Paid ${formatPlainDate(p.payment_date)}` : "Payment date not given"}
                      {p.reported_at ? ` · reported ${formatReviewDateTime(p.reported_at)}` : ""}
                      {p.status === "verified" && p.paid_at ? ` · verified ${formatReviewDateTime(p.paid_at)}` : ""}
                    </p>
                    {p.status === "rejected" && p.rejection_reason && (
                      <p className="mt-0.5 text-xs text-red-700">Rejected: {p.rejection_reason}</p>
                    )}
                  </div>
                  <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400 group-hover:text-primary" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
