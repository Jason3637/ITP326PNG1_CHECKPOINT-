import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AdminQueueItems } from "@/components/admin/AdminQueueItems";
import { OverviewKpis } from "@/components/admin/OverviewKpis";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { ADMIN_QUEUES, adminQueueDefinition, adminQueueHref } from "@/lib/admin-queues";
import { formatPlainDate } from "@/lib/penalties";
import { cn, focusRing } from "@/lib/utils";
import type { AdminAnalytics, AdminQueue, AdminQueueCounts, AdminQueuePage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

// How many of each queue's items the dashboard shows; the rest are one
// click away on the full, paginated queue page.
const PREVIEW_SIZE = 5;

// The queues below the figures, grouped the way the sidebar groups them.
// Two-up on wide screens so a short queue doesn't take a full row.
const QUEUE_GROUPS: { title: string; queues: AdminQueue[] }[] = [
  { title: "Applications", queues: ["awaiting_decision", "awaiting_disbursement"] },
  { title: "Loans", queues: ["overdue", "due_today", "due_this_week", "active_loans"] },
  { title: "Repayments", queues: ["repayments_awaiting_verification"] },
];

// The Administrator dashboard: what needs attention first, then the
// portfolio, then every admin queue. Counts come from GET /admin/queues,
// money from GET /admin/analytics, lists from GET /admin/queues/<queue> -
// so a count and the list under it always agree on what a queue contains.
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
    <div className="flex flex-col gap-8">
      <PageHeader title="Overview" description={`As of ${formatPlainDate(counts.as_of)}, Port Moresby time.`} />

      <OverviewKpis counts={counts} analytics={analytics} />

      {QUEUE_GROUPS.map((group) => {
        const headingId = `queues-${group.title.toLowerCase()}`;
        return (
          <section key={group.title} aria-labelledby={headingId} className="flex flex-col gap-3">
            <SectionHeader id={headingId} as="h3" title={group.title} />
            <div className={cn("grid gap-4", group.queues.length > 1 && "lg:grid-cols-2")}>
              {group.queues.map((key) => (
                <QueueCard key={key} queue={key} page={pages[key]} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// One queue's first few items, its total, and the way into the full queue.
function QueueCard({ queue, page }: { queue: AdminQueue; page: AdminQueuePage }) {
  const q = adminQueueDefinition(queue);
  return (
    <Card id={`queue-${queue}`} className="flex scroll-mt-24 flex-col p-0">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-lg font-bold tracking-tight text-neutral-900">{q.title}</h4>
            <Badge variant={page.total > 0 ? "primary" : "neutral"}>{page.total}</Badge>
          </div>
          <p className="mt-0.5 text-helper text-neutral-600">{q.description}</p>
        </div>
        {page.total > 0 && (
          <Link
            href={adminQueueHref(queue)}
            className={cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing)}
          >
            {page.total > page.items.length ? `View all ${page.total}` : "Open queue"}
          </Link>
        )}
      </div>

      <div className="px-2 pb-2">
        {page.items.length === 0 ? (
          <EmptyState size="sm" className="mx-3 mb-2 mt-3">
            {q.emptyMessage}
          </EmptyState>
        ) : (
          <AdminQueueItems page={page} />
        )}
      </div>
    </Card>
  );
}
