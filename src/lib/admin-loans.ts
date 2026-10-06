import { methodLabel, type RepaymentMethod } from "./report-repayment";
import type { AdminLedgerEntry, AdminLoanDetail, AdminPaymentStatus } from "./types";

// ---- loan status ------------------------------------------------------------
// From the loan's own status and closure reason - never inferred from figures.
export function adminLoanStatus(loan: Pick<AdminLoanDetail, "status" | "closure">): {
  label: string;
  variant: "success" | "danger" | "neutral" | "primary";
} {
  if (loan.status === "active") return { label: "Loan Active", variant: "success" };
  if (loan.status === "overdue") return { label: "Loan Overdue", variant: "danger" };
  if (loan.closure?.closure_reason === "defaulted") return { label: "Closed · Written off", variant: "neutral" };
  return { label: "Closed · Paid in full", variant: "primary" };
}

// ---- ledger -----------------------------------------------------------------
export function ledgerEntryLabel(e: Pick<AdminLedgerEntry, "entry_type" | "penalty_tier" | "payment_transaction_id">) {
  if (e.entry_type === "original_obligation") return "Original amount owed (principal + interest)";
  if (e.entry_type === "penalty") return e.penalty_tier ? `Late penalty, tier ${e.penalty_tier}` : "Late penalty";
  return e.payment_transaction_id ? `Verified repayment · payment #${e.payment_transaction_id}` : "Verified repayment";
}

// The ledger's story in the order entries were appended (entry id) - not
// re-sorted by effective date, which for a repayment is the date the
// customer says they paid and can precede an entry recorded earlier. Each
// line carries the balance after it: the plain sum of the backend's signed
// entries (owed is positive, paid is negative). The page also shows the
// backend's own outstanding figure and flags it if the two ever disagree.
export function ledgerWithBalance(entries: AdminLedgerEntry[]) {
  const ordered = [...entries].sort((a, b) => a.id - b.id);
  let cents = 0;
  return ordered.map((entry) => {
    cents += Math.round(entry.amount * 100);
    return { entry, balanceAfter: cents / 100 };
  });
}

export function signedKina(amount: number): string {
  const abs = Math.abs(amount).toLocaleString("en-US");
  return amount < 0 ? `− K${abs}` : `+ K${abs}`;
}

// ---- payments ---------------------------------------------------------------
// Verify / Reject are only ever offered while the backend still accepts
// them: a reported payment, or one whose verification has been started.
export const VERIFIABLE_STATUSES: readonly AdminPaymentStatus[] = ["reported", "verification_pending"];

export function canDecidePayment(status: AdminPaymentStatus): boolean {
  return VERIFIABLE_STATUSES.includes(status);
}

const PAYMENT_STATUS: Record<AdminPaymentStatus, { label: string; variant: "warning" | "success" | "danger" }> = {
  reported: { label: "Awaiting verification", variant: "warning" },
  verification_pending: { label: "Awaiting verification", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

export function paymentStatus(status: AdminPaymentStatus) {
  return PAYMENT_STATUS[status] ?? { label: "Unknown", variant: "warning" as const };
}

export function paymentMethodLabel(method: string | null): string {
  return method ? methodLabel(method as RepaymentMethod) : "Method not given";
}

export const REJECT_REASON_MAX_LENGTH = 500; // the backend keeps the first 500 characters

// Clearing a written-off customer to apply again: the backend's limit.
export const CLEAR_REASON_MAX_LENGTH = 1000;

// Writing off a loan: the backend's documented limit for a reason.
export const WRITE_OFF_REASON_MAX_LENGTH = 2000;

// The backend writes off only an active or overdue loan with something
// still owing. Offered on the same terms; the backend checks again.
export function canWriteOff(loan: Pick<AdminLoanDetail, "status" | "balance">): boolean {
  return (loan.status === "active" || loan.status === "overdue") && loan.balance.outstanding > 0;
}
