import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { MetricCard, type MetricTone } from "@/components/ui/MetricCard";
import { Section } from "@/components/ui/Section";
import { QueueTable } from "@/components/staff/QueueTable";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { getOfficerQueueCounts } from "@/lib/officer-queue-counts";
import { OFFICER_QUEUES, queueDefinition, queueHref } from "@/lib/officer-queues";
import { cn, focusRing } from "@/lib/utils";
import type { OfficerQueue, QueueAssignmentFilter, QueueCounts, QueueItem, QueuePage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

// How many of each list's oldest items the overview shows; the rest are one
// click away on the full, paginated queue page.
const PREVIEW_SIZE = 5;

// What each overview list reads: the same five queue queries as before,
// two of them narrowed to the officer's own with the backend's existing
// ?assigned=me filter. No extra requests.
const PREVIEWS: Record<OfficerQueue, QueueAssignmentFilter> = {
  under_review: "me",
  returned_by_admin: "me",
  awaiting_review: "any",
  customer_action_required: "any",
  sent_to_admin: "any",
};

// Queues where the officer has something to do: a figure here is work.
const ACTIONABLE = new Set<OfficerQueue>(["awaiting_review", "under_review", "returned_by_admin"]);

function previewPath(queue: OfficerQueue): string {
  const params = new URLSearchParams({ per_page: String(PREVIEW_SIZE) });
  if (PREVIEWS[queue] !== "any") params.set("assigned", PREVIEWS[queue]);
  return `/officer/queues/${queue}?${params}`;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// "View all (N)" to the queue behind a list, only when it holds more than
// the list shows - N is the backend's total for exactly that list.
function ViewAll({ page, assigned, label }: { page: QueuePage; assigned: QueueAssignmentFilter; label?: string }) {
  if (page.total <= page.items.length) return null;
  return (
    <Link href={queueHref(page.queue, { assigned })} className={linkClass}>
      {label ?? "View all"} ({page.total})
    </Link>
  );
}

// The Loan Officer overview, priority first: the five queue totals, then
// the officer's own work, then new applications anyone can claim, then -
// quieter - what's waiting on someone else. Deliberately no business-wide
// settings, parameters or other officers' performance figures - those are
// Administrator concerns (GET /admin/parameters, /reports/*), even where the
// officer token could read them.
//
// Data: GET /officer/queues (shared with the nav's counts - one read per
// request) and one page of each queue (GET /officer/queues/<queue>), so
// every figure and list is the backend's own queue query.
export default async function StaffDashboardPage() {
  let counts: QueueCounts;
  let pages: Record<OfficerQueue, QueuePage>;
  try {
    const [countsRes, ...pageRes] = await Promise.all([
      getOfficerQueueCounts(),
      ...OFFICER_QUEUES.map((q) => serverApiFetch<QueuePage>(previewPath(q.key))),
    ]);
    counts = countsRes;
    pages = Object.fromEntries(OFFICER_QUEUES.map((q, i) => [q.key, pageRes[i]])) as Record<OfficerQueue, QueuePage>;
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  // My work: returned applications first (an administrator is waiting on
  // them), then those under review - each oldest first, as the backend orders.
  const myWork: QueueItem[] = [...pages.returned_by_admin.items, ...pages.under_review.items];

  return (
    <div data-page-width="wide" className="flex flex-col gap-8">
      <section aria-labelledby="queue-summary-heading">
        <h2 id="queue-summary-heading" className="sr-only">
          Queue summary
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {OFFICER_QUEUES.map((q) => {
            const count = counts.queues[q.key] ?? { total: 0, mine: 0, unassigned: 0 };
            // New applications are normally unclaimed, so "unassigned" is
            // the number that matters there; elsewhere it's "yours".
            const detail =
              q.key === "awaiting_review" ? `${count.unassigned} unassigned` : `${count.mine} assigned to you`;
            const tone: MetricTone = count.total === 0 ? "calm" : ACTIONABLE.has(q.key) ? "attention" : "neutral";
            return (
              <MetricCard
                key={q.key}
                as="li"
                href={queueHref(q.key)}
                label={q.summaryLabel}
                value={count.total}
                status={detail}
                tone={tone}
              />
            );
          })}
        </ul>
      </section>

      <Section
        id="my-work"
        title="My work"
        description="Assigned to you: returned by an administrator, and under your review."
        actions={
          <>
            <ViewAll page={pages.returned_by_admin} assigned="me" label="All returned to you" />
            <ViewAll page={pages.under_review} assigned="me" label="All under your review" />
          </>
        }
      >
        <Card className="overflow-hidden p-0">
          <QueueTable
            items={myWork}
            caption="My work: applications assigned to you"
            emptyMessage="Nothing assigned to you right now."
            showAssignment={false}
          />
        </Card>
      </Section>

      <Section
        id="available"
        title="Available to claim"
        description="New applications. Open one to review it and claim it."
        actions={<ViewAll page={pages.awaiting_review} assigned="any" />}
      >
        <Card className="overflow-hidden p-0">
          <QueueTable
            items={pages.awaiting_review.items}
            caption="New applications available to claim"
            emptyMessage={queueDefinition("awaiting_review").emptyMessage}
          />
        </Card>
      </Section>

      <Section
        id="waiting"
        title="Waiting"
        description="With the customer or an administrator. Nothing to do until they respond."
      >
        <div className="grid gap-6 2xl:grid-cols-2 2xl:items-start">
          {(["customer_action_required", "sent_to_admin"] as const).map((key) => {
            const page = pages[key];
            const definition = queueDefinition(key);
            const headingId = `waiting-${key}`;
            return (
              <section key={key} aria-labelledby={headingId} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 id={headingId} className="text-sm font-semibold text-neutral-700">
                    {definition.summaryLabel}
                  </h3>
                  <ViewAll page={page} assigned="any" />
                </div>
                <Card className="overflow-hidden p-0 shadow-none">
                  <QueueTable items={page.items} caption={definition.summaryLabel} emptyMessage={definition.emptyMessage} />
                </Card>
              </section>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
