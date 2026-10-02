import type { CustomerHistoryLoan } from "./types";

// Loan status as staff read it. "closed" alone says nothing - the closure
// reason is what matters (paid in full vs defaulted).
export function loanStatusLabel(loan: Pick<CustomerHistoryLoan, "status" | "closure_reason">): string {
  if (loan.status === "closed") {
    if (loan.closure_reason === "paid_in_full") return "Closed - paid in full";
    if (loan.closure_reason === "defaulted") return "Closed - defaulted";
    return "Closed";
  }
  return { active: "Active", overdue: "Overdue", paid: "Paid" }[loan.status] ?? "Unknown status";
}

export type LoanTone = "success" | "warning" | "danger" | "neutral";

export function loanStatusTone(loan: Pick<CustomerHistoryLoan, "status" | "closure_reason">): LoanTone {
  if (loan.status === "paid" || loan.closure_reason === "paid_in_full") return "success";
  if (loan.status === "overdue" || loan.closure_reason === "defaulted") return "danger";
  if (loan.status === "active") return "warning";
  return "neutral";
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
