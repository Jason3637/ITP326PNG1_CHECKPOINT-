import { Card, CardTitle } from "@/components/ui/Card";
import { AuditEntry } from "@/components/admin/audit/AuditEntry";
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
          {entries.map((e) => (
            <AuditEntry key={e.id} entry={e} />
          ))}
        </ol>
      )}
    </Card>
  );
}
