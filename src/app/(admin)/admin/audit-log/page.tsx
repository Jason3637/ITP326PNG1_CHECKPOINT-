import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Inbox } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AuditEntry } from "@/components/admin/audit/AuditEntry";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import {
  AUDIT_ACTION_GROUPS,
  AUDIT_ROLES,
  auditApiQuery,
  auditLabel,
  auditLogHref,
  hasFilters,
  parseAuditFilters,
} from "@/lib/audit-log";
import { parsePage } from "@/lib/officer-queues";
import { cn, focusRing } from "@/lib/utils";
import type { AuditLogPage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

const PER_PAGE = 50;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const fieldClass = "h-9 rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900";
const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// The full audit log (GET /reports/audit-logs), newest first, 50 a page.
// Filters - actor (role and/or user id), action, date range - live in the
// URL, so a filtered view can be refreshed or shared. Entries render with
// the same AuditEntry as a loan's audit history.
export default async function AdminAuditLogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseAuditFilters(sp);
  const requestedPage = parsePage(sp.page);

  let data: AuditLogPage;
  try {
    data = await serverApiFetch<AuditLogPage>(`/reports/audit-logs?${auditApiQuery(filters, requestedPage, PER_PAGE)}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    if (err instanceof ApiError && err.status === 400) {
      return (
        <Card className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="font-medium text-neutral-900">Those filters can&apos;t be used</p>
            <Link href="/admin/audit-log" className={cn("mt-1 inline-block", linkClass)}>
              Clear the filters
            </Link>
          </div>
        </Card>
      );
    }
    throw err;
  }

  const pages = Math.max(1, data.pages);
  const first = data.total === 0 ? 0 : (data.page - 1) * data.per_page + 1;
  const last = Math.min(data.page * data.per_page, data.total);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900">Audit log</h2>
        <p className="mt-1 text-sm text-neutral-600">Everything the system has recorded, newest first. Times are Port Moresby time.</p>
      </div>

      <Card>
        <form method="get" action="/admin/audit-log" className="flex flex-wrap items-end gap-3" aria-label="Filter the audit log">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            Actor role
            <select name="role" defaultValue={filters.role ?? ""} className={fieldClass}>
              <option value="">Anyone</option>
              {AUDIT_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            Actor user #
            <input name="actor" inputMode="numeric" pattern="\d*" defaultValue={filters.actorId ?? ""} placeholder="any" className={cn(fieldClass, "w-24")} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            Action
            <select name="action" defaultValue={filters.action ?? ""} className={cn(fieldClass, "max-w-[16rem]")}>
              <option value="">Any action</option>
              {AUDIT_ACTION_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.actions.map((a) => (
                    <option key={a} value={a}>
                      {auditLabel(a)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            From
            <input type="date" name="from" defaultValue={filters.from ?? ""} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            To
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={fieldClass} />
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Apply
          </Button>
          {hasFilters(filters) && (
            <Link href="/admin/audit-log" className={linkClass}>
              Clear
            </Link>
          )}
        </form>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{hasFilters(filters) ? "Matching entries" : "All entries"}</CardTitle>
          <Badge variant="neutral">{data.total}</Badge>
        </div>
        {data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Inbox className="h-7 w-7 text-neutral-300" aria-hidden="true" />
            <p className="text-sm text-neutral-600">
              {data.total > 0 ? "Nothing on this page." : hasFilters(filters) ? "No entries match these filters." : "Nothing recorded yet."}
            </p>
          </div>
        ) : (
          <ol className="mt-4 flex flex-col gap-4 border-l border-neutral-200 pl-4">
            {data.items.map((e) => (
              <AuditEntry key={e.id} entry={e} full />
            ))}
          </ol>
        )}

        {pages > 1 && (
          <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <p className="text-sm text-neutral-600">
              {first}–{last} of {data.total}
            </p>
            <div className="flex items-center gap-4">
              {data.page > 1 && (
                <Link href={auditLogHref(filters, data.page - 1)} className={linkClass}>
                  Newer
                </Link>
              )}
              <span className="text-sm text-neutral-600">
                Page {data.page} of {pages}
              </span>
              {data.page < pages && (
                <Link href={auditLogHref(filters, data.page + 1)} className={linkClass}>
                  Older
                </Link>
              )}
            </div>
          </nav>
        )}
      </Card>
    </div>
  );
}
