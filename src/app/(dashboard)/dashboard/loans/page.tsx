import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { formatKina } from "@/lib/utils";
import { customerLoanBadge, isCurrentLoan } from "@/lib/loan-status";
import type { MyLoans } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

export default async function MyLoansPage() {
  let data: MyLoans;
  try {
    data = await serverApiFetch<MyLoans>("/loans/mine");
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  return (
    <Card>
      <CardTitle>My loans</CardTitle>

      {data.loans.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Inbox className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="text-sm text-neutral-500">No loans yet.</p>
          <p className="text-xs text-neutral-400">Once a loan application is approved, it&apos;ll show up here.</p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
          {data.loans.map((loan) => (
            <li key={loan.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">
                  {formatKina(loan.principal_amount)} over {loan.term_days} days
                </p>
                <p className="text-xs text-neutral-500">{formatKina(loan.total_repayable)} total repayable</p>
                {isCurrentLoan(loan) && loan.balance && (
                  <p className="text-xs font-medium text-neutral-700">
                    {formatKina(loan.balance.outstanding)} still owed
                    {loan.balance.penalties > 0 ? `, including ${formatKina(loan.balance.penalties)} in late penalties` : ""}
                  </p>
                )}
              </div>
              <Badge variant={customerLoanBadge(loan).variant}>{customerLoanBadge(loan).label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
