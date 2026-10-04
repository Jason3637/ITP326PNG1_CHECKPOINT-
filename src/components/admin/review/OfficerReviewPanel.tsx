import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatReviewDateTime } from "@/lib/application-review";
import { CHECKLIST_STATUS_LABELS } from "@/lib/checklist";
import { recommendationLabel } from "@/lib/recommendations";
import type { ApplicationReview } from "@/lib/types";

// The loan officer's side of the application, as the administrator decides
// on it: who reviewed it, what they recommended, why, when, and the
// checklist exactly as it stood when they sent it (the backend's frozen
// snapshot). Earlier rounds and returns are in the Recommendations history.
export function OfficerReviewPanel({ review }: { review: Pick<ApplicationReview, "recommendations" | "assignment"> }) {
  const latest = review.recommendations.at(-1) ?? null;
  const officer = latest?.officer_name ?? review.assignment.officer_name;
  const snapshot = latest?.checklist_snapshot ?? [];
  const required = snapshot.filter((i) => i.required);
  const done = required.filter((i) => i.status === "verified" || i.status === "not_applicable").length;
  const problems = snapshot.filter((i) => i.status === "failed");
  const outstanding = required.filter((i) => !["verified", "not_applicable", "failed"].includes(i.status));

  return (
    <Card>
      <CardTitle>Loan Officer review</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">{officer ? `Reviewed by ${officer}` : "No officer assigned yet."}</p>

      {!latest ? (
        <p className="mt-3 text-sm text-neutral-700">The loan officer hasn&apos;t sent a recommendation yet.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={latest.recommendation === "recommend_approval" ? "success" : "danger"}>
              {recommendationLabel(latest.recommendation)}
            </Badge>
            {latest.created_at && (
              <span className="text-xs text-neutral-600">{formatReviewDateTime(latest.created_at)}</span>
            )}
          </div>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Comments</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-neutral-900">{latest.comments}</p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Checklist when recommended
          </h3>
          <p className="mt-1 text-sm font-medium text-neutral-900">
            {done} of {required.length} required checks done
          </p>
          {problems.length > 0 && (
            <p className="mt-1 text-sm text-red-700">Problem found: {problems.map((i) => i.label).join(", ")}</p>
          )}
          {outstanding.length > 0 && (
            <p className="mt-1 text-sm text-neutral-700">Not done: {outstanding.map((i) => i.label).join(", ")}</p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-neutral-700">Every check</summary>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-700">
              {snapshot.map((i) => (
                <li key={i.item_type}>
                  {i.label}: {CHECKLIST_STATUS_LABELS[i.status] ?? i.status}
                  {i.note ? ` - "${i.note}"` : ""}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </Card>
  );
}
