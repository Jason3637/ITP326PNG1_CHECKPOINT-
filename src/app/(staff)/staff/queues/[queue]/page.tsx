import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Inbox } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { QueueItemRow } from "@/components/staff/QueueItemRow";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import {
  ASSIGNMENT_FILTERS,
  isOfficerQueue,
  parseAssignmentFilter,
  parsePage,
  queueDefinition,
  queueHref,
} from "@/lib/officer-queues";
import { cn, focusRing } from "@/lib/utils";
import type { QueuePage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

interface PageProps {
  params: Promise<{ queue: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// One full work queue, oldest submission first (the backend's order), 25
// per page. Filters and paging live in the URL so a filtered view can be
// refreshed, bookmarked or shared between officers.
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

  const multiStatus = data.statuses.length > 1;
  const first = data.total === 0 ? 0 : (data.page - 1) * data.per_page + 1;
  const last = Math.min(data.page * data.per_page, data.total);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/staff" className={cn("inline-flex w-fit items-center gap-1", linkClass)}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <Card className="px-2 sm:px-5">
        <div className="px-3 sm:px-0">
          <div className="flex items-center gap-2">
            <CardTitle>{definition.title}</CardTitle>
            <Badge variant={data.total > 0 ? "primary" : "neutral"}>{data.total}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-600">{definition.description}</p>

          <nav aria-label="Filter by assignment" className="mt-4 flex flex-wrap gap-2">
            {ASSIGNMENT_FILTERS.map((f) => {
              const active = f.value === assigned;
              return (
                <Link
                  key={f.value}
                  href={queueHref(queue, { assigned: f.value })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium",
                    focusRing,
                    active
                      ? "border-primary bg-primary-light text-primary-dark"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Inbox className="h-7 w-7 text-neutral-300" aria-hidden="true" />
            <p className="text-sm text-neutral-600">
              {data.total > 0
                ? "No applications on this page."
                : assigned === "any"
                  ? definition.emptyMessage
                  : "No applications match this filter."}
            </p>
            {data.total > 0 && (
              <Link href={queueHref(queue, { assigned })} className={linkClass}>
                Go to the first page
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
            {data.items.map((item) => (
              <QueueItemRow key={item.id} item={item} showStatus={multiStatus} />
            ))}
          </ul>
        )}

        {data.pages > 1 && (
          <nav
            aria-label="Pagination"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-3 pt-4 sm:px-0"
          >
            <p className="text-sm text-neutral-600">
              {first}–{last} of {data.total}
            </p>
            <div className="flex items-center gap-4">
              {data.page > 1 && (
                <Link href={queueHref(queue, { assigned, page: data.page - 1 })} className={linkClass}>
                  Previous
                </Link>
              )}
              <span className="text-sm text-neutral-600">
                Page {data.page} of {data.pages}
              </span>
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
