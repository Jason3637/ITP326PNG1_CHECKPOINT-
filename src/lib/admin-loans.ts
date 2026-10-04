import { methodLabel, type RepaymentMethod } from "./report-repayment";
import type { AdminAuditEntry, AdminLedgerEntry, AdminLoanDetail, AdminPaymentStatus } from "./types";

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

// ---- audit history ----------------------------------------------------------
const AUDIT_LABELS: Record<string, string> = {
  loan_application_submitted: "Application submitted",
  loan_application_admin_review_started: "Administrator review started",
  loan_application_decision: "Final decision",
  loan_application_awaiting_disbursement: "Approved — Awaiting Disbursement",
  loan_application_returned_to_officer: "Returned to the loan officer",
  loan_disbursed: "Disbursed · loan created",
  loan_penalty_applied: "Late penalty added",
  loan_status_changed: "Loan status changed",
  loan_closed: "Loan closed",
  loan_written_off: "Loan written off",
  payment_reported: "Repayment reported by the customer",
  payment_verification_started: "Repayment verification started",
  payment_verified: "Repayment verified",
  payment_rejected: "Repayment rejected",
  repayment_marked_overdue: "Installment marked overdue",
  repayment_reminder_sent: "Repayment reminder sent",
};

export function auditLabel(action: string): string {
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  const words = action.replaceAll("_", " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Event";
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  loan_officer: "Loan Officer",
  customer: "Customer",
};

export function auditActor(role: string | null): string {
  return role ? (ROLE_LABELS[role] ?? "Staff") : "System";
}

// A few named, human-meaningful fields from the free-form details - never
// the whole dict (it can carry internal ids).
export function auditSummary(entry: Pick<AdminAuditEntry, "details">): string | null {
  const d = entry.details ?? {};
  const parts: string[] = [];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  if (str(d.decision)) parts.push(d.decision === "approve" ? "Approved" : "Rejected");
  if (str(d.from) && str(d.to)) parts.push(`${String(d.from).replaceAll("_", " ")} → ${String(d.to).replaceAll("_", " ")}`);
  if (num(d.amount) !== null) parts.push(`K${num(d.amount)!.toLocaleString("en-US")}`);
  if (str(d.method_reference)) parts.push(`Ref ${str(d.method_reference)}`);
  for (const key of ["reason", "note"] as const) if (str(d[key])) parts.push(`“${str(d[key])}”`);
  return parts.length ? parts.join(" · ") : null;
}
