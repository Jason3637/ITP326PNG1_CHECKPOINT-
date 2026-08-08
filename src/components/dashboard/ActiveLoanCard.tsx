import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatKina } from "@/lib/utils";
import type { Loan } from "@/lib/types";

interface ActiveLoanCardProps {
  loan: Loan;
}

// No repayment schedule exists yet, so "next repayment" is a projected
// placeholder (the 1st of next month) rather than data from the mock loan.
function nextRepaymentDate() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function ActiveLoanCard({ loan }: ActiveLoanCardProps) {
  return (
    <Card className="animate-card-enter flex h-full flex-col">
      <CardHeader>
        <CardTitle>Active loan</CardTitle>
        <Badge variant="success">Active</Badge>
      </CardHeader>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-neutral-500">Outstanding balance</p>
          <p className="text-2xl font-semibold text-neutral-900">{formatKina(loan.totalRepayable)}</p>
        </div>

        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-sm text-neutral-500">Next repayment</p>
          <p className="text-sm font-medium text-neutral-900">
            {formatKina(loan.monthlyPayment)} due {nextRepaymentDate()}
          </p>
        </div>
      </div>

      <Link
        href={`/dashboard/loans/${loan.id}/schedule`}
        className="mt-auto pt-4 text-sm font-medium text-primary hover:underline"
      >
        View full repayment schedule
      </Link>
    </Card>
  );
}
