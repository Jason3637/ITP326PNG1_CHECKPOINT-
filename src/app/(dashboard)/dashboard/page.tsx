import { redirect } from "next/navigation";
import { HandCoins, ClipboardList, ListChecks, User } from "lucide-react";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ActionTiles, type ActionTile } from "@/components/dashboard/ActionTiles";
import { ActiveLoanCard } from "@/components/dashboard/ActiveLoanCard";
import { BorrowingPowerCard } from "@/components/dashboard/BorrowingPowerCard";
import { ApplicationStatusCard } from "@/components/dashboard/ApplicationStatusCard";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { isApplicationFinished, isTerminalRejected } from "@/lib/loan-wizard";
import { isCurrentLoan } from "@/lib/loan-status";
import { daysUntil } from "@/lib/utils";
import type { AccountSummary, Dashboard, LoanApplicationList, MyLoans } from "@/lib/types";

// See (dashboard)/layout.tsx - explicit for the same reason, applied
// again here since this page calls serverApiFetch independently.
export const dynamic = "force-dynamic";

// Item 1's exact primary-action set for a customer with no loan and no
// application in progress — deliberately just these four, not a smaller
// copy of the staff/internal workflow.
const PRIMARY_ACTIONS: ActionTile[] = [
  { label: "Apply for a Loan", href: "/dashboard/loans/apply", icon: HandCoins, primary: true },
  { label: "My Applications", href: "/dashboard/applications", icon: ClipboardList },
  { label: "My Loans", href: "/dashboard/loans", icon: ListChecks },
  { label: "My Profile", href: "/dashboard/profile", icon: User },
];

// While an application is in progress, the backend's "only one open
// application at a time" rule means Apply for a Loan isn't a real option
// right now, so it's dropped rather than shown and then rejected.
const IN_PROGRESS_ACTIONS: ActionTile[] = [
  { label: "My Applications", href: "/dashboard/applications", icon: ClipboardList, primary: true },
  { label: "My Loans", href: "/dashboard/loans", icon: ListChecks },
  { label: "My Profile", href: "/dashboard/profile", icon: User },
];

export default async function DashboardPage() {
  let summary: AccountSummary;
  let dashboard: Dashboard;
  try {
    [summary, dashboard] = await Promise.all([
      serverApiFetch<AccountSummary>("/accounts/summary"),
      serverApiFetch<Dashboard>("/reports/dashboard"),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    // Anything else (backend 500, timeout, unreachable) is caught by
    // this route segment's error.tsx boundary, which offers a real retry.
    throw err;
  }

  // An overdue loan is still the customer's current loan - it used to be
  // missed here (counts.active excludes overdue), so an overdue customer
  // saw their application card instead of the loan they need to repay.
  const hasCurrentLoan = summary.counts.active + summary.counts.overdue > 0;

  if (hasCurrentLoan) {
    let loans: MyLoans;
    try {
      loans = await serverApiFetch<MyLoans>("/loans/mine");
    } catch (err) {
      if (err instanceof UnauthenticatedError) redirect("/login");
      throw err;
    }
    const activeLoan = loans.loans.find(isCurrentLoan);
    const nextInstallment = activeLoan?.repayment_schedule.find((item) => item.status !== "paid");
    const daysRemaining = nextInstallment ? daysUntil(nextInstallment.due_date) : null;

    return (
      <div className="flex flex-col gap-4 lg:gap-6">
        <ActiveLoanCard
          kpis={dashboard.kpis}
          hasOverdue={summary.has_overdue}
          loan={activeLoan}
          daysRemaining={daysRemaining}
        />

        <div>
          <h2 className="font-accent mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Quick actions
          </h2>
          <QuickActions />
        </div>
      </div>
    );
  }

  // No active loan yet - check the customer's own applications (live,
  // via GET /loans/applications/mine, added alongside the two-tier
  // officer/admin review chain).
  let applications: LoanApplicationList;
  try {
    applications = await serverApiFetch<LoanApplicationList>("/loans/applications/mine");
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }
  // Only one open application is ever allowed at a time - the most recent
  // is always the relevant one, whatever its status.
  const latest = applications.applications[0] ?? null;

  // Still in progress (including approved and waiting for the payout).
  // A finished one - rejected, or paid out with its loan since repaid -
  // falls through to the normal "Apply for a Loan" view below.
  if (latest && !isApplicationFinished(latest)) {
    return (
      <div className="flex flex-col gap-4 lg:gap-6">
        <ApplicationStatusCard application={latest} />
        <div>
          <h2 className="font-accent mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Quick actions
          </h2>
          <ActionTiles actions={IN_PROGRESS_ACTIONS} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {latest && isTerminalRejected(latest.status) ? <ApplicationStatusCard application={latest} /> : <BorrowingPowerCard />}

      <div>
        <h2 className="font-accent mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Quick actions
        </h2>
        <ActionTiles actions={PRIMARY_ACTIONS} />
      </div>
    </div>
  );
}
