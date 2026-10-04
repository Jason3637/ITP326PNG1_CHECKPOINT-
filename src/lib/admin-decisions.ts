import type { OfficerRecommendationType } from "./types";

// The administrator's three final-review actions. Amount and term are
// never editable here (Phase 1 decision) - the screen offers no such UI.
export type AdminDecision = "approve" | "reject" | "return";

// What the page shows after a decision (?decided=...), checked against the
// application's real status before anything is shown.
export type DecisionOutcome = "approved" | "rejected" | "returned";

export const REASON_MAX_LENGTH = 2000; // the backend's limit for reason and note

const OUTCOME_FOR: Record<AdminDecision, DecisionOutcome> = {
  approve: "approved",
  reject: "rejected",
  return: "returned",
};

export function outcomeFor(decision: AdminDecision): DecisionOutcome {
  return OUTCOME_FOR[decision];
}

export function isAdminDecision(value: unknown): value is AdminDecision {
  return value === "approve" || value === "reject" || value === "return";
}

export function parseOutcome(value: unknown): DecisionOutcome | null {
  return value === "approved" || value === "rejected" || value === "returned" ? value : null;
}

// The status each outcome must have produced - the banner only shows when
// the application really is there.
export const OUTCOME_STATUS: Record<DecisionOutcome, string> = {
  approved: "awaiting_disbursement",
  rejected: "rejected",
  returned: "returned_to_officer",
};

// Approving against an officer's recommendation to reject needs a written
// note (the backend refuses it otherwise). Rejecting always needs a reason,
// which also covers rejecting against a recommendation to approve.
export function approvalNeedsNote(latest: OfficerRecommendationType | null): boolean {
  return latest === "recommend_rejection";
}

export function textRequired(decision: AdminDecision, latest: OfficerRecommendationType | null): boolean {
  return decision !== "approve" || approvalNeedsNote(latest);
}

export function validateDecision(
  decision: AdminDecision,
  text: string,
  latest: OfficerRecommendationType | null,
): string | null {
  const trimmed = text.trim();
  if (textRequired(decision, latest) && !trimmed) return DECISION_COPY.options[decision].required;
  if (trimmed.length > REASON_MAX_LENGTH) return `Keep it under ${REASON_MAX_LENGTH} characters.`;
  return null;
}

export const DECISION_COPY = {
  title: "Final decision",
  intro: "Approve, reject, or send it back to the loan officer. The amount and term can't be changed here.",
  options: {
    approve: {
      label: "Approve",
      help: "Moves it to Approved — Awaiting Disbursement. No loan is created until it's paid out.",
      textLabel: "Why are you approving against the officer's recommendation?",
      placeholder: "e.g. Income is confirmed by the employer; the referee issue was resolved by phone.",
      required: "Explain why you're approving against the officer's recommendation to reject.",
      confirm: "Approve application",
      confirmTitle: "Approve this application?",
      confirmBody:
        "It moves to Approved — Awaiting Disbursement. No loan is created and no money moves yet: the loan starts only when it's disbursed.",
    },
    reject: {
      label: "Reject",
      help: "Ends the application. A reason is required.",
      textLabel: "Reason for rejecting",
      placeholder: "e.g. Income couldn't be verified with the employer.",
      required: "Give a reason for rejecting.",
      confirm: "Reject application",
      confirmTitle: "Reject this application?",
      confirmBody: "This is final. The application is closed and the customer is told it was declined.",
    },
    return: {
      label: "Return to Loan Officer",
      help: "Sends it back for more work before you decide. A reason is required.",
      textLabel: "What should the loan officer look at?",
      placeholder: "e.g. The payslip is from June; ask for a current one.",
      required: "Tell the loan officer why it's coming back.",
      confirm: "Return to Loan Officer",
      confirmTitle: "Return this application to the loan officer?",
      confirmBody: "It goes back to the loan officer's Returned queue with your reason. Nothing is decided yet.",
    },
  } satisfies Record<AdminDecision, Record<string, string>>,
  submit: "Review decision",
  back: "Back",
  textHeading: "Your reason",
};
