import type { Loan, LoanApplication } from "./types";

// PRIMESTONE allows one PRIME loan per customer at a time. The backend enforces this on POST /loans/apply (409);
// this mirrors its rule (loan_processing.submit_application) so customers
// aren't offered "Apply" only to be refused after filling in the form. The
// backend's refusal stays the real guard.
//
// Blocking, as the backend defines it:
// - an application in progress (the open statuses below);
// - an application approved and waiting to be paid out (approved, or
//   awaiting_disbursement with no loan yet - once paid out, its loan's
//   status decides);
// - a loan that's active or overdue;
// - a written-off loan PRIMESTONE hasn't cleared yet (the backend's
//   blocks_reapplication flag - an admin clears it with a reason).
// Never blocking: rejected applications, loans closed as paid in full, and
// written-off loans that have been cleared.
const OPEN_STATUSES = new Set([
  "submitted",
  "officer_review",
  "customer_action_required",
  "recommended_for_approval",
  "recommended_for_rejection",
  "admin_review",
  "returned_to_officer",
]);

export type ApplyBlockKind = "current_loan" | "awaiting_payout" | "open_application" | "written_off";

export interface ApplyBlock {
  kind: ApplyBlockKind;
  message: string;
  href: string;
  linkLabel: string;
}

type AppLike = Pick<LoanApplication, "id" | "status" | "loan_id">;
type LoanLike = Pick<Loan, "id" | "status" | "closure_reason" | "blocks_reapplication">;

// The reason a new application isn't possible right now, or null - checked
// in the backend's order (first match wins) with the backend's own
// wording, so the customer reads here exactly what applying would say.
export function applyBlock(applications: AppLike[], loans: LoanLike[]): ApplyBlock | null {
  const open = applications.find((a) => OPEN_STATUSES.has(a.status));
  if (open) {
    return {
      kind: "open_application",
      message: `You already have an open application (#${open.id}).`,
      href: "/dashboard/applications",
      linkLabel: "View your applications",
    };
  }
  const awaiting = applications.find(
    (a) => a.status === "approved" || (a.status === "awaiting_disbursement" && a.loan_id == null),
  );
  if (awaiting) {
    return {
      kind: "awaiting_payout",
      message: `Your application #${awaiting.id} is approved and waiting to be paid out. You can apply again once that loan is fully repaid.`,
      href: "/dashboard/applications",
      linkLabel: "View your applications",
    };
  }
  const current = loans.find((l) => l.status === "active" || l.status === "overdue");
  if (current) {
    return {
      kind: "current_loan",
      message: `You still have a loan (#${current.id}) to repay. You can apply again once it's fully repaid.`,
      href: "/dashboard/loans",
      linkLabel: "View your loan",
    };
  }
  // The backend's flag decides - it knows whether an admin has cleared it.
  const writtenOff = loans.find((l) => l.blocks_reapplication === true);
  if (writtenOff) {
    return {
      kind: "written_off",
      message: `Your loan (#${writtenOff.id}) was written off, so you can't apply for a new PRIME loan until PRIMESTONE has reviewed it. Contact PRIMESTONE to ask for a review.`,
      href: "/dashboard/loans",
      linkLabel: "View your loans",
    };
  }
  return null;
}
