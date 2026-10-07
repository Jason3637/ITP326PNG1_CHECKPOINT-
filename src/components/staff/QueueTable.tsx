import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CompactEmptyState } from "@/components/ui/EmptyState";
import { formatReviewDate } from "@/lib/application-review";
import {
  applicationReviewHref,
  assignmentLabel,
  daysWaiting,
  purposeLabel,
  queueRowAction,
  waitingLabel,
} from "@/lib/officer-queues";
import { statusPresentation } from "@/lib/status-presentation";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { QueueItem } from "@/lib/types";

interface QueueTableProps {
  items: QueueItem[];
  // Names the table for screen readers ("Under review, assigned to you").
  caption: string;
  // Shown, on one line, when there are no items.
  emptyMessage: string;
  // Hides the Assigned column where every row is the viewer's own.
  showAssignment?: boolean;
  className?: string;
}

// A value the backend didn't send: a dash for the eye, words for screen readers.
function Missing({ label = "Not recorded" }: { label?: string }) {
  return (
    <>
      <span aria-hidden="true" className="text-neutral-400">
        —
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

function Assignment({ item }: { item: QueueItem }) {
  return (
    <span className={cn(item.is_mine ? "font-medium text-primary-dark" : "text-neutral-700")}>{assignmentLabel(item)}</span>
  );
}

// What needs a second look, under the status: open requests, an admin's
// return reason. Shown in full - the reason is the officer's instruction.
function StatusNotes({ item }: { item: QueueItem }) {
  const open = item.open_information_requests;
  return (
    <>
      {open > 0 && (
        <span className="mt-1 block text-xs text-amber-800">
          {open === 1 ? "1 open information request" : `${open} open information requests`}
        </span>
      )}
      {item.returned_reason && (
        // Capped so a long reason wraps in its own column instead of
        // squeezing the customer and amount columns.
        <span className="mt-1 block max-w-xs text-xs text-amber-800">Returned: {item.returned_reason}</span>
      )}
    </>
  );
}

function Status({ item }: { item: QueueItem }) {
  const p = statusPresentation("application", item.status);
  return (
    <StatusBadge tone={p.tone} icon={p.icon}>
      {p.label}
    </StatusBadge>
  );
}

// One work queue as a dense list: a real table from md up (one row per
// application, consistent columns), stacked rows on phones. Each row has a
// single link - its action (Review / Continue / View) - stretched over the
// whole row, so the row is clickable while keyboard and screen-reader users
// meet one link per application. Every field shown is the backend's own;
// a missing one shows as a dash, never a guess.
export function QueueTable({ items, caption, emptyMessage, showAssignment = true, className }: QueueTableProps) {
  if (items.length === 0) {
    return <CompactEmptyState className={className}>{emptyMessage}</CompactEmptyState>;
  }

  const rows = items.map((item) => {
    const action = queueRowAction(item);
    const days = daysWaiting(item.submitted_at);
    return {
      item,
      action,
      href: applicationReviewHref(item.id),
      purpose: purposeLabel(item.purpose_category),
      age: waitingLabel(days),
      submitted: formatReviewDate(item.submitted_at),
      customer: item.customer_name ?? "Unknown customer",
    };
  });

  const th = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 first:pl-5 last:pr-5";
  const td = "px-3 py-3 align-top first:pl-5 last:pr-5";

  return (
    <div className={className}>
      <table className="hidden w-full text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-neutral-200 bg-neutral-50">
          <tr>
            <th scope="col" className={th}>
              Application
            </th>
            <th scope="col" className={th}>
              Customer
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              Amount
            </th>
            <th scope="col" className={th}>
              PRIME
            </th>
            <th scope="col" className={th}>
              Status
            </th>
            {showAssignment && (
              <th scope="col" className={th}>
                Assigned
              </th>
            )}
            <th scope="col" className={th}>
              Age
            </th>
            <th scope="col" className={th}>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map(({ item, action, href, purpose, age, submitted, customer }) => (
            <tr key={item.id} className="relative hover:bg-neutral-50 focus-within:bg-neutral-50">
              <td className={td}>
                <span className="font-medium text-neutral-900 tabular-nums">#{item.id}</span>
                {purpose && <span className="mt-0.5 block text-xs text-neutral-600">{purpose}</span>}
              </td>
              <td className={cn(td, "text-neutral-900")}>{customer}</td>
              <td className={cn(td, "text-right font-medium tabular-nums text-neutral-900")}>
                {formatKina(item.amount_requested)}
              </td>
              <td className={cn(td, "whitespace-nowrap text-neutral-700")}>{item.prime_category ?? <Missing />}</td>
              <td className={td}>
                <Status item={item} />
                <StatusNotes item={item} />
              </td>
              {showAssignment && (
                <td className={td}>
                  <Assignment item={item} />
                </td>
              )}
              <td className={cn(td, "whitespace-nowrap")}>
                {age ? <span className="text-neutral-900">{age}</span> : <Missing />}
                {submitted && <span className="mt-0.5 block text-xs text-neutral-600">Submitted {submitted}</span>}
              </td>
              <td className={cn(td, "text-right")}>
                <Link
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1 rounded font-medium text-primary hover:text-primary-dark",
                    // Stretched over the row: the whole row is the link's target.
                    "after:absolute after:inset-0 after:content-['']",
                    focusRing,
                  )}
                >
                  {action}
                  <span className="sr-only">
                    {" "}
                    application #{item.id}, {customer}
                  </span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-neutral-100 md:hidden" aria-label={caption}>
        {rows.map(({ item, action, href, purpose, age, submitted, customer }) => (
          <li key={item.id}>
            <Link href={href} className={cn("flex items-start gap-3 px-4 py-3 hover:bg-neutral-50", focusRing)}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="font-medium text-neutral-900">
                    #{item.id} · {customer}
                  </p>
                  <Status item={item} />
                </div>
                <p className="mt-1 text-sm text-neutral-700">
                  <span className="font-medium tabular-nums">{formatKina(item.amount_requested)}</span>
                  {item.prime_category ? ` · ${item.prime_category}` : ""}
                  {purpose ? ` · ${purpose}` : ""}
                </p>
                <StatusNotes item={item} />
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-600">
                  {age && <span className="font-medium text-neutral-700">{age}</span>}
                  {submitted && <span>Submitted {submitted}</span>}
                  {showAssignment && <Assignment item={item} />}
                </p>
              </div>
              <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary">
                {action}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
