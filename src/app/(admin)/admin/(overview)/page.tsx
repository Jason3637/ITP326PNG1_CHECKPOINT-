import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AdminQueueItems } from "@/components/admin/AdminQueueItems";
import { DashboardSummary } from "@/components/admin/DashboardSummary";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { ADMIN_QUEUES, adminQueueHref } from "@/lib/admin-queues";
import { formatPlainDate } from "@/lib/penalties";
import { cn, focusRing } from "@/lib/utils";
import type { AdminAnalytics, AdminQueue, AdminQueueCounts, AdminQueuePage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

// How many of each queue's items the dashboard shows; the rest are one
// click away on the full, paginated queue page.
const PREVIEW_SIZE = 5;

// The Administrator dashboard: the five summary questions, then every
// admin queue. Counts come from GET /admin/queues, money from GET
// /admin/analytics, lists from GET /admin/queues/<queue> - so a count and
// the list under it always agree on what a queue contains.
export default async function AdminDashboardPage() {
  let counts: AdminQueueCounts;
  let analytics: AdminAnalytics;
  let pages: Record<AdminQueue, AdminQueuePage>;
  try {
    const [countsRes, analyticsRes, ...pageRes] = await Promise.all([
      serverApiFetch<AdminQueueCounts>("/admin/queues"),
      serverApiFetch<AdminAnalytics>("/admin/analytics"),
      ...ADMIN_QUEUES.map((q) => serverApiFetch<AdminQueuePage>(`/admin/queues/${q.key}?per_page=${PREVIEW_SIZE}`)),
    ]);
    counts = countsRes;
    analytics = analyticsRes;
    pages = Object.fromEntries(ADMIN_QUEUES.map((q, i) => [q.key, pageRes[i]])) as Record<AdminQueue, AdminQueuePage>;
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="summary-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="summary-heading" className="font-display text-lg font-bold tracking-tight text-neutral-900">
            Overview
          </h2>
          <p className="text-sm text-neutral-600">As of {formatPlainDate(counts.as_of)}, Port Moresby time.</p>
        </div>
        <DashboardSummary counts={counts} analytics={analytics} />
      </section>

      {ADMIN_QUEUES.map((q) => {
        const page = pages[q.key];
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
                  href={adminQueueHref(q.key)}
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
              <AdminQueueItems page={page} />
            )}
          </Card>
        );
      })}
    </div>
  );
}
