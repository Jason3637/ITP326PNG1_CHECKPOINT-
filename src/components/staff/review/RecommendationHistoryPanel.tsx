import { Undo2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatReviewDateTime } from "@/lib/application-review";
import { CHECKLIST_STATUS_LABELS } from "@/lib/checklist";
import { statusPresentation } from "@/lib/status-presentation";
import type { ReviewAdminReturn, ReviewRecommendation } from "@/lib/types";

// Every recommendation made on this application, each with the checklist
// exactly as it stood when it was sent (the backend's frozen
// checklist_snapshot), plus any return from the administrator. Rendered
// only when there's at least one recommendation.
export function RecommendationHistoryPanel({
  recommendations,
  adminReturns,
}: {
  recommendations: ReviewRecommendation[];
  adminReturns: ReviewAdminReturn[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <Card>
      <CardTitle>Recommendations</CardTitle>
      <ol className="mt-3 flex flex-col gap-4">
        {recommendations.map((rec) => {
          const snapshot = rec.checklist_snapshot ?? [];
          const required = snapshot.filter((i) => i.required);
          const done = required.filter((i) => i.status === "verified" || i.status === "not_applicable").length;
          const returned = adminReturns.filter((r) => r.recommendation_id === rec.id);
          const verdict = statusPresentation("recommendation", rec.recommendation);
          return (
            <li key={rec.id} className="rounded-lg border border-neutral-200 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={verdict.tone}>{verdict.label}</Badge>
                <span className="text-xs text-neutral-600">
                  {rec.officer_name ? `by ${rec.officer_name}` : ""}
                  {rec.created_at ? ` · ${formatReviewDateTime(rec.created_at)}` : ""}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-neutral-900">{rec.comments}</p>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-neutral-700">
                  Checklist when sent: {done} of {required.length} required checks done
                </summary>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-700">
                  {snapshot.map((i) => (
                    <li key={i.item_type}>
                      {i.label}: {CHECKLIST_STATUS_LABELS[i.status] ?? i.status}
                      {i.note ? ` - "${i.note}"` : ""}
                    </li>
                  ))}
                </ul>
              </details>

              {returned.map((r) => (
                <div key={r.id} className="mt-3 flex items-start gap-2 rounded bg-warning-light/50 p-2 text-sm">
                  <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-neutral-900">
                      Returned by {r.returned_by_name ?? "the administrator"}
                      {r.created_at ? ` · ${formatReviewDateTime(r.created_at)}` : ""}
                    </p>
                    <p className="text-neutral-700">{r.reason}</p>
                  </div>
                </div>
              ))}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
