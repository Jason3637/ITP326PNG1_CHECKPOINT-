import Link from "next/link";
import { formatReviewDateTime } from "@/lib/application-review";
import { auditActor, auditDetailRows, auditEntityHref, auditEntityLabel, auditLabel, auditSummary } from "@/lib/audit-log";
import { cn, focusRing } from "@/lib/utils";
import type { AdminAuditEntry, AuditLogItem } from "@/lib/types";

// One audit entry, the same way everywhere: what happened, when, who, and
// a short summary. The full audit log adds the subject, the actor's id and
// address, and every (non-hidden) detail field.
export function AuditEntry({ entry, full = false }: { entry: AdminAuditEntry | AuditLogItem; full?: boolean }) {
  const summary = auditSummary(entry);
  const item = full ? (entry as AuditLogItem) : null;
  const href = item ? auditEntityHref(item) : null;
  const rows = item ? auditDetailRows(item.details) : [];
  return (
    <li className="relative">
      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-neutral-300" aria-hidden="true" />
      <p className="text-sm font-medium text-neutral-900">{auditLabel(entry.action)}</p>
      <p className="text-xs text-neutral-600">
        {formatReviewDateTime(entry.created_at) ?? "Time not recorded"} · {auditActor(entry.actor_role)}
        {item?.actor_id ? ` #${item.actor_id}` : ""}
        {item?.ip_address ? ` · ${item.ip_address}` : ""}
      </p>
      {item && (
        <p className="text-xs text-neutral-600">
          {href ? (
            <Link href={href} className={cn("rounded font-medium text-primary hover:text-primary-dark", focusRing)}>
              {auditEntityLabel(item)}
            </Link>
          ) : (
            auditEntityLabel(item)
          )}
        </p>
      )}
      {summary && <p className="mt-0.5 text-xs text-neutral-700">{summary}</p>}
      {rows.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-medium text-neutral-700">Details</summary>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-neutral-600">{k}</dt>
                <dd className="break-all text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </li>
  );
}
