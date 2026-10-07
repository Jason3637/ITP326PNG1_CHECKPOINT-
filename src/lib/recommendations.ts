import type { OfficerRecommendationType } from "./types";

// The backend's limit (loan_processing.submit_recommendation).
export const COMMENTS_MAX_LENGTH = 2000;

export function validateRecommendation(kind: OfficerRecommendationType | "", comments: string): string | null {
  if (kind !== "recommend_approval" && kind !== "recommend_rejection") return "Choose approval or rejection.";
  if (!comments.trim()) return "Add your comments - the administrator reads these with the recommendation.";
  if (comments.trim().length > COMMENTS_MAX_LENGTH) return `Keep comments under ${COMMENTS_MAX_LENGTH} characters.`;
  return null;
}

export function isRecommendationType(value: unknown): value is OfficerRecommendationType {
  return value === "recommend_approval" || value === "recommend_rejection";
}

// Every user-facing string for the recommendation action lives here, so
// the wording rule can be tested in one place: an officer's recommendation
// is ONLY a recommendation. Nothing may suggest the application is
// approved/rejected, that a loan exists or is active, or that money is
// moving - the backend creates no loan and no disbursement at this step,
// and the administrator alone decides.
export const RECOMMENDATION_COPY = {
  title: "Recommendation",
  intro: "Send your recommendation to an administrator. The administrator reviews it and makes the final decision.",
  options: {
    recommend_approval: {
      label: "Recommend approval",
      help: "All required checks are done and you recommend the administrator approve this application.",
    },
    recommend_rejection: {
      label: "Recommend rejection",
      help: "You recommend the administrator reject this application. Explain why in your comments.",
    },
  },
  approvalBlocked:
    "Recommending approval needs every required check verified or marked not applicable, with no problems found.",
  commentsLabel: "Comments for the administrator",
  snapshotNote: "The checklist exactly as it stands now is recorded with your recommendation.",
  submit: "Review and send",
  confirmTitle: (kind: OfficerRecommendationType) =>
    kind === "recommend_approval" ? "Send a recommendation to approve?" : "Send a recommendation to reject?",
  confirmBody:
    "The application moves to Sent to Administrator and leaves your review. You can't change the recommendation afterwards - an administrator can return it to you if more work is needed.",
  confirm: "Send to Administrator",
  back: "Back",
  sentTitle: (kind: OfficerRecommendationType) =>
    kind === "recommend_approval" ? "Recommendation to approve sent." : "Recommendation to reject sent.",
  sentBody: (applicationId: number) =>
    `Application #${applicationId} is now with the administrator for a decision. It's no longer in your active review queues.`,
} as const;

export function recommendationLabel(kind: string): string {
  return kind === "recommend_approval"
    ? "Recommended approval"
    : kind === "recommend_rejection"
      ? "Recommended rejection"
      : "Recommendation";
}

// Language that must never appear around a recommendation. Used by tests
// against every rendered recommendation screen and against RECOMMENDATION_COPY.
export const FORBIDDEN_RECOMMENDATION_WORDING =
  /\b(approved|rejected|declined|loan is (now )?active|active loan|disburs\w*|funds?|payout|paid out|money (is|will be) sent|transfer(red)?)\b/i;
