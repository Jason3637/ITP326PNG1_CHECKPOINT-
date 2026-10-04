import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { QueueItemRow } from "@/components/staff/QueueItemRow";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { OFFICER_QUEUES, queueHref } from "@/lib/officer-queues";
import { cn, focusRing } from "@/lib/utils";
import type { OfficerQueue, QueueCounts, QueuePage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

// How many of each queue's oldest items the dashboard shows; the rest are
// one click away on the full, paginated queue page.
const PREVIEW_SIZE = 5;

// The Loan Officer dashboard: work queues only. Deliberately no
// business-wide settings, system parameters or other officers' workload/
// performance figures - those are Administrator concerns (GET
// /admin/parameters, /reports/*), even where the officer token could read
// them. Assignment on each row (yours / unassigned / another officer's) is
// shown because it decides who picks the item up, not to rank officers.
//
// Counts and lists come from the backend's real queue queries (GET
// /officer/queues and /officer/queues/<queue>), so a count and the list
// under it always agree on what a queue contains.
export default async function StaffDashboardPage() {
  let counts: QueueCounts;
  let pages: Record<OfficerQueue, QueuePage>;
  try {
    const [countsRes, ...pageRes] = await Promise.all([
      serverApiFetch<QueueCounts>("/officer/queues"),
      ...OFFICER_QUEUES.map((q) => serverApiFetch<QueuePage>(`/officer/queues/${q.key}?per_page=${PREVIEW_SIZE}`)),
    ]);
    counts = countsRes;
    pages = Object.fromEntries(OFFICER_QUEUES.map((q, i) => [q.key, pageRes[i]])) as Record<OfficerQueue, QueuePage>;
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="queue-summary-heading">
        <h2 id="queue-summary-heading" className="sr-only">
          Queue summary
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {OFFICER_QUEUES.map((q) => {
            const count = counts.queues[q.key] ?? { total: 0, mine: 0, unassigned: 0 };
            // New applications are unclaimed by definition, so "yours" is
            // always 0 there - "unassigned" is the number that matters.
            const detail =
              q.key === "awaiting_review" ? `${count.unassigned} unassigned` : `${count.mine} assigned to you`;
            return (
              <li key={q.key}>
                <a
                  href={`#queue-${q.key}`}
                  className={cn(
                    "flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-primary",
                    focusRing,
                  )}
                >
                  <span className="text-xs font-medium text-neutral-600">{q.summaryLabel}</span>
                  <span className="mt-1 font-display text-3xl font-bold tracking-tight text-neutral-900">
                    {count.total}
                  </span>
                  <span className="mt-auto pt-1 text-xs text-neutral-500">{detail}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {OFFICER_QUEUES.map((q) => {
        const page = pages[q.key];
        const multiStatus = page.statuses.length > 1;
        return (
          <Card key={q.key} id={`queue-${q.key}`} className="scroll-mt-20 px-2 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-2 px-3 sm:px-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle>{q.title}</CardTitle>
                  <Badge variant={page.total > 0 ? "primary" : "neutral"}>{page.total}</Badge>
                </div>
                <p className="mt-1 text-sm text-neutral-600">{q.description}</p>
              </div>
              {page.total > 0 && (
                <Link
                  href={queueHref(q.key)}
                  className={cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing)}
                >
                  {page.total > page.items.length ? `View all ${page.total}` : "Open queue"}
                </Link>
              )}
            </div>

            {page.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Inbox className="h-7 w-7 text-neutral-300" aria-hidden="true" />
                <p className="text-sm text-neutral-600">{q.emptyMessage}</p>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
                {page.items.map((item) => (
                  <QueueItemRow key={item.id} item={item} showStatus={multiStatus} />
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
