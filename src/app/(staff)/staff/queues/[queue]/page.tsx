import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CompactEmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueueTable } from "@/components/staff/QueueTable";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { getOfficerQueueCounts } from "@/lib/officer-queue-counts";
import {
  ASSIGNMENT_FILTERS,
  isOfficerQueue,
  parseAssignmentFilter,
  parsePage,
  queueDefinition,
  queueHref,
} from "@/lib/officer-queues";
import { cn, focusRing } from "@/lib/utils";
import type { QueueAssignmentFilter, QueueCount, QueuePage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

interface PageProps {
  params: Promise<{ queue: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// How many of the queue each assignment filter holds, from GET
// /officer/queues - the same backend counts as the nav, read once per request.
function filterCount(count: QueueCount | undefined, filter: QueueAssignmentFilter): number | undefined {
  if (!count) return undefined;
  return filter === "me" ? count.mine : filter === "unassigned" ? count.unassigned : count.total;
}

// One full work queue, oldest submission first (the backend's order), 25
// per page. Filters and paging live in the URL so a filtered view can be
// refreshed, bookmarked or shared between officers.
//
// Every queue keeps all three assignment filters. The backend makes each
// meaningful everywhere: an administrator can assign a new application
// before anyone claims it (so "Assigned to me" can hold new ones), and an
// officer's account being removed leaves their applications unassigned in
// any later stage (assigned_officer_id ondelete SET NULL). Each filter shows
// how many it holds instead, so an empty one is obvious before it's chosen.
// There's no search: the backend has none, and searching only the loaded
// page would silently miss matches on the others.
export default async function QueuePageView({ params, searchParams }: PageProps) {
  const { queue } = await params;
  if (!isOfficerQueue(queue)) notFound();

  const sp = await searchParams;
  const assigned = parseAssignmentFilter(sp.assigned);
  const requestedPage = parsePage(sp.page);
  const definition = queueDefinition(queue);

  const query = new URLSearchParams({ page: String(requestedPage), per_page: String(PER_PAGE) });
  if (assigned !== "any") query.set("assigned", assigned);

  let data: QueuePage;
  try {
    data = await serverApiFetch<QueuePage>(`/officer/queues/${queue}?${query}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  // Optional: without it the filters just show no counts.
  let count: QueueCount | undefined;
  try {
    count = (await getOfficerQueueCounts()).queues[queue];
  } catch {
    count = undefined;
  }

  const first = data.total === 0 ? 0 : (data.page - 1) * data.per_page + 1;
  const last = Math.min(data.page * data.per_page, data.total);
  const activeFilter = ASSIGNMENT_FILTERS.find((f) => f.value === assigned)!;

  return (
    <div data-page-width="wide" className="flex flex-col gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Back to dashboard" }}
        title={definition.title}
        meta={<Badge variant={data.total > 0 ? "primary" : "neutral"}>{data.total}</Badge>}
        description={definition.description}
      />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 sm:px-5">
          <nav aria-label="Filter by assignment" className="flex flex-wrap gap-2">
            {ASSIGNMENT_FILTERS.map((f) => {
              const active = f.value === assigned;
              const n = filterCount(count, f.value);
              return (
                <Link
                  key={f.value}
                  href={queueHref(queue, { assigned: f.value })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium",
                    focusRing,
                    active
                      ? "border-primary bg-primary-light text-primary-dark"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  )}
                >
                  {f.label}
                  {n !== undefined && (
                    <>
                      <span aria-hidden="true" className={cn("tabular-nums", n === 0 && !active && "text-neutral-400")}>
                        {n}
                      </span>
                      <span className="sr-only">, {n === 1 ? "1 application" : `${n} applications`}</span>
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
          {data.total > 0 && (
            <p className="text-sm text-neutral-600 tabular-nums">
              {first}–{last} of {data.total}
            </p>
          )}
        </div>

        {data.items.length === 0 && data.total > 0 ? (
          <CompactEmptyState className="m-4" action={<Link href={queueHref(queue, { assigned })} className={linkClass}>Go to the first page</Link>}>
            No applications on this page.
          </CompactEmptyState>
        ) : (
          <QueueTable
            items={data.items}
            caption={`${definition.title}, ${activeFilter.label.toLowerCase()}`}
            emptyMessage={assigned === "any" ? definition.emptyMessage : "No applications match this filter."}
            className={data.items.length === 0 ? "m-4" : undefined}
          />
        )}

        {data.pages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 sm:px-5"
          >
            <p className="text-sm text-neutral-600">
              Page {data.page} of {data.pages}
            </p>
            <div className="flex items-center gap-4">
              {data.page > 1 && (
                <Link href={queueHref(queue, { assigned, page: data.page - 1 })} className={linkClass}>
                  Previous
                </Link>
              )}
              {data.page < data.pages && (
                <Link href={queueHref(queue, { assigned, page: data.page + 1 })} className={linkClass}>
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </Card>
    </div>
  );
}
