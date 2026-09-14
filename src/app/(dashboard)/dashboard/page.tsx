import { redirect } from "next/navigation";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ActiveLoanCard } from "@/components/dashboard/ActiveLoanCard";
import { BorrowingPowerCard } from "@/components/dashboard/BorrowingPowerCard";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import type { AccountSummary, Dashboard } from "@/lib/types";

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

  const hasActiveLoan = summary.counts.active > 0;

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {hasActiveLoan ? (
        <ActiveLoanCard kpis={dashboard.kpis} hasOverdue={summary.has_overdue} />
      ) : (
        <BorrowingPowerCard />
      )}

      <div>
        <h2 className="font-accent mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Quick actions
        </h2>
        <QuickActions />
      </div>
    </div>
  );
}
