import type { Loan } from "./types";

type LoanLike = Pick<Loan, "status" | "closure_reason">;

// Loans still being repaid. "overdue" is still a current loan - it's the
// one the customer most needs to see.
export function isCurrentLoan(loan: Pick<Loan, "status">): boolean {
  return loan.status === "active" || loan.status === "overdue";
}

export type LoanBadgeVariant = "success" | "warning" | "danger" | "neutral";

// The customer-facing badge for a loan. A repaid loan is now "closed" with
// closure_reason "paid_in_full" (the backend no longer sets "paid"), and a
// written-off one is "closed" with "defaulted" - so "closed" alone can't
// say which, and closure_reason decides. "paid" is still handled for loans
// closed before that change.
export function customerLoanBadge(loan: LoanLike): { label: string; variant: LoanBadgeVariant } {
  if (loan.status === "active") return { label: "Active", variant: "success" };
  if (loan.status === "overdue") return { label: "Overdue", variant: "danger" };
  if (loan.status === "paid" || loan.closure_reason === "paid_in_full") return { label: "Paid off", variant: "success" };
  if (loan.closure_reason === "defaulted") return { label: "Written off", variant: "danger" };
  if (loan.status === "closed") return { label: "Closed", variant: "neutral" };
  return { label: "Unknown status", variant: "neutral" };
}
