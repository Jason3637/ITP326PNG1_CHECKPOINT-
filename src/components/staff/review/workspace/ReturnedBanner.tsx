import { Undo2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { formatReviewDateTime } from "@/lib/application-review";
import { recommendationLabel } from "@/lib/recommendations";
import type { ReviewAdminReturn, ReviewRecommendation } from "@/lib/types";

// Statuses in which a return is still the officer's to act on.
const OPEN_STAGES = ["returned_to_officer", "officer_review", "customer_action_required"];

// The administrator's latest return, if no recommendation has been sent
// since - the one the officer is working to answer.
export function pendingReturn(
  status: string,
  adminReturns: ReviewAdminReturn[],
  recommendations: ReviewRecommendation[],
): ReviewAdminReturn | null {
  const latest = adminReturns.at(-1);
  if (!latest || !OPEN_STAGES.includes(status)) return null;
  const answered = recommendations.some((r) => r.created_at && latest.created_at && r.created_at > latest.created_at);
  return answered ? null : latest;
}

// Above the tabs, from the moment the administrator returns the application
// until a new recommendation goes: who returned it, when, why, and which
// recommendation it was. The new recommendation goes through the same panel.
export function ReturnedBanner({
  status,
  adminReturns,
  recommendations,
}: {
  status: string;
  adminReturns: ReviewAdminReturn[];
  recommendations: ReviewRecommendation[];
}) {
  const ret = pendingReturn(status, adminReturns, recommendations);
  if (!ret) return null;
  const returned = recommendations.find((r) => r.id === ret.recommendation_id) ?? null;
  return (
    <div data-workflow-banner="returned">
      <Alert
        tone="warning"
        role={null}
        icon={Undo2}
        title={`Returned by ${ret.returned_by_name ?? "the administrator"}${ret.created_at ? ` · ${formatReviewDateTime(ret.created_at)}` : ""}`}
      >
        <p className="whitespace-pre-line">{ret.reason}</p>
        <p className="mt-1 text-xs">
          {returned
            ? `This was about the ${recommendationLabel(returned.recommendation).toLowerCase()}${returned.officer_name ? ` by ${returned.officer_name}` : ""}. `
            : ""}
          {status === "returned_to_officer"
            ? "Resume the review to update the checks and send a new recommendation."
            : "Send a new recommendation from the Recommendation panel when you're ready."}
        </p>
      </Alert>
    </div>
  );
}
