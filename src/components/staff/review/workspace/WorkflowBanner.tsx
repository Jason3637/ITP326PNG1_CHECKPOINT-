import { CheckCircle2, ChevronRight, Hourglass } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { TabLink } from "@/components/ui/TabLink";
import { formatReviewDateTime } from "@/lib/application-review";
import { groupIntoRounds, requestTypeLabel, requiredItems } from "@/lib/information-requests";
import type { ReviewInformationRequest, ReviewRecommendation } from "@/lib/types";

interface WorkflowBannerProps {
  applicationId: number;
  status: string;
  requests: ReviewInformationRequest[];
  recommendations: ReviewRecommendation[];
  // Set right after this officer sent the round (the ?requested= count):
  // the banner opens with that confirmation, so there's one message, not two.
  justSent?: number | null;
}

function RoundsLink() {
  return (
    <TabLink tab="verification" className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap">
      See the rounds
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </TabLink>
  );
}

// Where the information-request side of the review stands, above the tabs
// so it's seen from every tab:
//   * waiting - the application is with the customer: which round, when and
//     by whom, what was asked, how much is still open. A recommendation
//     can't be sent until then (the backend offers it only under review).
//   * responded - the latest round has come back and nothing has been
//     recommended since: the review can carry on.
// Nothing otherwise. Every value is the backend's own.
export function WorkflowBanner({ applicationId, status, requests, recommendations, justSent = null }: WorkflowBannerProps) {
  const rounds = groupIntoRounds(requests);
  const round = rounds.at(-1);
  if (!round) return null;
  const n = rounds.length;
  const open = round.requests.filter((r) => r.status === "open");
  const requester = round.requests[0]?.requested_by_name;

  if (status === "customer_action_required" && open.length > 0) {
    return (
      <div data-workflow-banner="waiting">
        <Alert
          tone="warning"
          role="status"
          icon={Hourglass}
          title={`Waiting on the customer · Round ${n}`}
          actions={<RoundsLink />}
        >
          {justSent !== null && (
            <p className="mb-1 font-medium">
              {justSent === 1 ? "Request sent to the customer." : `${justSent} requests sent to the customer.`} Application #
              {applicationId} is now waiting on the customer and comes back to you under review once they respond.
            </p>
          )}
          <p>
            Requested {formatReviewDateTime(round.requestedAt) ?? "on an unknown date"}
            {requester ? ` by ${requester}` : ""} · {open.length} of {round.requests.length} still open.
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {round.requests.map((r) => (
              <li key={r.id}>
                <span className="font-medium">{requestTypeLabel(r.request_type)}</span>
                {requiredItems(r).length > 0 ? ` - ${requiredItems(r).join("; ")}` : ""}
                {r.status !== "open" ? ` (${r.status === "responded" ? "answered" : "cancelled"})` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            A recommendation can be sent once the customer responds, or after you resume the review.
          </p>
        </Alert>
      </div>
    );
  }

  const responses = round.requests.map((r) => r.response?.responded_at).filter((t): t is string => !!t);
  const answeredAt = responses.length ? responses.sort().at(-1)! : null;
  const recommendedSince = answeredAt && recommendations.some((rec) => rec.created_at && rec.created_at > answeredAt);
  if (status === "officer_review" && open.length === 0 && answeredAt && !recommendedSince) {
    return (
      <div data-workflow-banner="responded">
        <Alert tone="success" role={null} icon={CheckCircle2} title="The customer responded - review can continue" actions={<RoundsLink />}>
          Round {n} answered {formatReviewDateTime(answeredAt)}. Their answers, documents and any changed details are in the
          Verification tab.
        </Alert>
      </div>
    );
  }
  return null;
}
