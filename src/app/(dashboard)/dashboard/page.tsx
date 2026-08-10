import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { ActiveLoanCard } from "@/components/dashboard/ActiveLoanCard";
import { BorrowingPowerCard } from "@/components/dashboard/BorrowingPowerCard";
import { mockMember, mockLoans } from "@/lib/mock-data";

export default function DashboardPage() {
  const activeLoan = mockLoans.find(
    (loan) => loan.memberId === mockMember.id && loan.status === "active",
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {activeLoan ? (
        <ActiveLoanCard loan={activeLoan} />
      ) : (
        <BorrowingPowerCard maxLoanAmount={mockMember.maxLoanAmount} />
      )}

      <div>
        <h2 className="font-accent mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Quick actions
        </h2>
        <QuickActions />
      </div>

      <RecentTransactions />
    </div>
  );
}
