import { redirect } from "next/navigation";
import { Inbox, Receipt } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { cn, formatKina } from "@/lib/utils";
import type { LoanPaymentList, MyLoans } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function RepaymentHistoryPage() {
  let loans: MyLoans;
  try {
    loans = await serverApiFetch<MyLoans>("/loans/mine");
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  // Payments are recorded per loan (GET /api/payments/loan/{loan_id}) -
  // there's no single "all my payments" endpoint, so this shows the most
  // relevant loan (the active one, or the most recently created) rather
  // than requiring the member to pick one. Members with more than one
  // loan in their history only see one loan's payments here for now.
  const relevantLoan = loans.loans.find((l) => l.status === "active") ?? loans.loans[loans.loans.length - 1];

  let payments: LoanPaymentList | null = null;
  if (relevantLoan) {
    try {
      payments = await serverApiFetch<LoanPaymentList>(`/payments/loan/${relevantLoan.id}`);
    } catch (err) {
      if (err instanceof UnauthenticatedError) redirect("/login");
      throw err;
    }
  }

  return (
    <Card>
      <CardTitle>Repayment history</CardTitle>

      {!relevantLoan || !payments || payments.payments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Inbox className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="text-sm text-neutral-500">No repayments recorded yet.</p>
          <p className="text-xs text-neutral-400">
            {relevantLoan ? "Payments against this loan will show up here." : "You don't have a loan yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
          {payments.payments.map((payment) => (
            <li key={payment.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  "bg-success-light text-success",
                )}
              >
                <Receipt className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {payment.payment_method.replace(/_/g, " ")} payment
                </p>
                <p className="text-xs text-neutral-500">{formatDate(payment.paid_at)}</p>
              </div>
              <p className="tabular-nums text-sm font-semibold text-success">{formatKina(payment.amount)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
