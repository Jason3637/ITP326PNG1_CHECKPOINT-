import { Card, CardTitle } from "@/components/ui/Card";
import { formatReviewDateTime } from "@/lib/application-review";
import { auditActor, auditLabel, auditSummary } from "@/lib/admin-loans";
import type { AdminAuditEntry } from "@/lib/types";

// The audit trail for the loan, its application and its payments, oldest
// first, as the backend recorded it. Only named detail fields are shown.
export function AuditHistoryPanel({ entries }: { entries: AdminAuditEntry[] }) {
  return (
    <Card>
      <CardTitle>Audit history</CardTitle>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">No audit entries.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3 border-l border-neutral-200 pl-4">
          {entries.map((e) => {
            const summary = auditSummary(e);
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-neutral-300" aria-hidden="true" />
                <p className="text-sm font-medium text-neutral-900">{auditLabel(e.action)}</p>
                <p className="text-xs text-neutral-600">
                  {formatReviewDateTime(e.created_at) ?? "Time not recorded"} · {auditActor(e.actor_role)}
                </p>
                {summary && <p className="mt-0.5 text-xs text-neutral-700">{summary}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
