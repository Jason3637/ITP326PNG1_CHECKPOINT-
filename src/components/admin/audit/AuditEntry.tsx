import { formatReviewDateTime } from "@/lib/application-review";
import { auditActor, auditLabel, auditSummary } from "@/lib/audit-log";
import type { AdminAuditEntry } from "@/lib/types";

// One audit entry in a loan's audit history: what happened, when, who, and
// a short summary. The full audit log is a table (AuditTable).
export function AuditEntry({ entry }: { entry: AdminAuditEntry }) {
  const summary = auditSummary(entry);
  return (
    <li className="relative">
      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-neutral-300" aria-hidden="true" />
      <p className="text-sm font-medium text-neutral-900">{auditLabel(entry.action)}</p>
      <p className="text-xs text-neutral-600">
        {formatReviewDateTime(entry.created_at) ?? "Time not recorded"} · {auditActor(entry.actor_role)}
      </p>
      {summary && <p className="mt-0.5 text-xs text-neutral-700">{summary}</p>}
    </li>
  );
}
