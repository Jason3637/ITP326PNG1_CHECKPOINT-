import { notFound, redirect } from "next/navigation";
import { ReportRepaymentForm } from "@/components/dashboard/report-repayment/ReportRepaymentForm";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import type { MyLoans } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ loanId: string }>;
}

export default async function ReportRepaymentPage({ params }: PageProps) {
  const { loanId } = await params;

  let loans: MyLoans;
  try {
    loans = await serverApiFetch<MyLoans>("/loans/mine");
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  // GET /loans/mine only ever returns the caller's own loans, so finding it
  // in this list is itself the ownership check — no separate authorization
  // call needed.
  const loan = loans.loans.find((l) => String(l.id) === loanId);
  if (!loan) notFound();

  // PRIME is a single bullet repayment - there's exactly one installment,
  // so the next unpaid one (normally the only one) is always the right
  // target. Falls back to the first row if every installment is somehow
  // already paid (nothing left to report against, but avoids a crash).
  const installment =
    loan.repayment_schedule.find((item) => item.status !== "paid") ?? loan.repayment_schedule[0];
  if (!installment) notFound();

  // The installment row only ever holds the original amount, so once that
  // is paid a remaining late penalty is reported against the same row
  // (the backend allows it). Show the full amount owed when we have it.
  return (
    <ReportRepaymentForm
      loanId={loan.id}
      repaymentScheduleId={installment.id}
      outstanding={loan.balance?.outstanding ?? null}
      penalties={loan.balance?.penalties ?? 0}
    />
  );
}
