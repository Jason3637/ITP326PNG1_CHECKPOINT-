import { SavingsBalanceCard } from "@/components/dashboard/SavingsBalanceCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { ActiveLoanCard } from "@/components/dashboard/ActiveLoanCard";
import { LoanEligibilityPrompt } from "@/components/dashboard/LoanEligibilityPrompt";
import { mockMember, mockLoans, mockSavingsTrend } from "@/lib/mock-data";

export default function DashboardPage() {
  const activeLoan = mockLoans.find(
    (loan) => loan.memberId === mockMember.id && loan.status === "active",
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="lg:order-1 lg:col-span-2">
        <SavingsBalanceCard balance={mockMember.savingsBalance} trend={mockSavingsTrend} />
      </div>

      <div className="lg:order-2 lg:col-span-1">
        {activeLoan ? (
          <ActiveLoanCard loan={activeLoan} />
        ) : (
          <LoanEligibilityPrompt eligibleAmount={mockMember.loanEligibility} />
        )}
      </div>

      <div className="lg:order-3 lg:col-span-3">
        <h2 className="font-accent mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Quick actions
        </h2>
        <QuickActions />
      </div>

      <div className="lg:order-4 lg:col-span-3">
        <RecentTransactions />
      </div>
    </div>
  );
}
