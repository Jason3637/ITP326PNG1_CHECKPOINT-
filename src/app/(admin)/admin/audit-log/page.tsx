import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { AuditTable } from "@/components/admin/audit/AuditTable";
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

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// The full audit log (GET /reports/audit-logs), newest first, 50 a page,
// as a table (components/admin/audit/AuditTable). Filters - actor (role
// and/or user id), action, date range - live in the URL, so a filtered
// view can be refreshed or shared.
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
        <Alert tone="danger" role={null} title="Those filters can't be used">
          <Link href="/admin/audit-log" className={linkClass}>
            Clear the filters
          </Link>
        </Alert>
      );
    }
    throw err;
  }

  const pages = Math.max(1, data.pages);
  const first = data.total === 0 ? 0 : (data.page - 1) * data.per_page + 1;
  const last = Math.min(data.page * data.per_page, data.total);
  const filtered = hasFilters(filters);

  // Wide: a log line carries a lot, so the shell gives this page 1440px.
  return (
    <div data-page-width="wide" className="flex flex-col gap-6">
      <PageHeader title="Audit log" description="Everything the system has recorded, newest first. Times are Port Moresby time." />

      <Card className="p-4">
        <form
          method="get"
          action="/admin/audit-log"
          aria-label="Filter the audit log"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end"
        >
          <Select name="role" label="Actor role" defaultValue={filters.role ?? ""}>
            <option value="">Anyone</option>
            {AUDIT_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Input
            name="actor"
            label="Actor user #"
            inputMode="numeric"
            pattern="\d*"
            defaultValue={filters.actorId ?? ""}
            placeholder="Any"
            className="w-full"
          />
          <Select name="action" label="Action" defaultValue={filters.action ?? ""}>
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
          </Select>
          <Input type="date" name="from" label="From" defaultValue={filters.from ?? ""} className="w-full" />
          <Input type="date" name="to" label="To" defaultValue={filters.to ?? ""} className="w-full" />
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary">
              Apply
            </Button>
            {filtered && (
              <Link href="/admin/audit-log" className={linkClass}>
                Clear
              </Link>
            )}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 px-4 py-3">
          <h3 className="font-display text-lg font-bold tracking-tight text-neutral-900">
            {filtered ? "Matching entries" : "All entries"}
          </h3>
          <Badge variant="neutral">{data.total}</Badge>
        </div>

        {data.items.length === 0 ? (
          <EmptyState className="border-t border-neutral-200">
            {data.total > 0 ? "Nothing on this page." : filtered ? "No entries match these filters." : "Nothing recorded yet."}
          </EmptyState>
        ) : (
          <AuditTable items={data.items} />
        )}

        {pages > 1 && (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
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
