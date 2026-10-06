// What colour a backend status reads as. The status strings are the
// backend's own values (types.ts), never renamed; this only says how each
// one is presented. Labels stay with each screen's own helpers
// (staffStatusLabel, paymentStatus, ...) - a tone isn't a label.
//
//   success  green  approved, paid, verified, done
//   warning  amber  waiting on someone: pending, awaiting, due soon
//   danger   red    rejected, overdue, failed
//   info     blue   moving along: submitted, in review
//   neutral  grey   closed, cancelled, inactive, not applicable
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<string, StatusTone> = {
  // Loan applications (LoanApplicationStatus)
  draft: "neutral",
  submitted: "info",
  officer_review: "info",
  customer_action_required: "warning",
  recommended_for_approval: "warning",
  recommended_for_rejection: "warning",
  admin_review: "info",
  approved: "success",
  rejected: "danger",
  awaiting_disbursement: "warning",
  disbursed: "success",
  returned_to_officer: "warning",

  // Loans (LoanStatus) and closure reasons. "closed" alone is grey; a
  // screen that knows the closure reason can ask for that instead.
  active: "success",
  overdue: "danger",
  paid: "success",
  closed: "neutral",
  paid_in_full: "success",
  defaulted: "danger",

  // Repayments (PaymentStatus) and the repayment queue filter
  reported: "warning",
  verification_pending: "warning",
  verified: "success",
  awaiting: "warning",

  // Installments
  upcoming: "info",

  // Verification checklist items (ChecklistItemStatus)
  pending: "warning",
  failed: "danger",
  not_applicable: "neutral",

  // Information requests (InformationRequestStatus)
  open: "warning",
  responded: "info",
  cancelled: "neutral",

  // Loan Officer queue stages
  awaiting_review: "warning",
  under_review: "info",
  sent_to_admin: "info",
  returned_by_admin: "warning",

  // Admin queues
  awaiting_decision: "warning",
  due_today: "warning",
  due_this_week: "warning",
  repayments_awaiting_verification: "warning",

  // Generic
  successful: "success",
  critical: "danger",
  inactive: "neutral",
};

// Unknown values read as neutral rather than guessing good or bad.
export function statusTone(status: string | null | undefined): StatusTone {
  return (status && TONES[status]) || "neutral";
}
