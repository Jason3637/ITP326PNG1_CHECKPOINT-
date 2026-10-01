import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, focusRing, formatKina } from "@/lib/utils";
import {
  applicationReviewHref,
  assignmentLabel,
  daysWaiting,
  purposeLabel,
  staffStatusLabel,
  waitingLabel,
} from "@/lib/officer-queues";
import type { QueueItem } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface QueueItemRowProps {
  item: QueueItem;
  // Only for queues that cover more than one status (sent_to_admin) - in
  // the others every row would carry the same badge.
  showStatus?: boolean;
}

// One application in a work queue - enough to triage without opening it.
// The whole row links into the Application Review Workspace. Stacks on
// narrow screens; on md+ the waiting time and assignment move to a right-
// hand column so a long queue scans top-to-bottom.
export function QueueItemRow({ item, showStatus = false }: QueueItemRowProps) {
  const purpose = purposeLabel(item.purpose_category);
  const waiting = waitingLabel(daysWaiting(item.submitted_at));
  const openRequests = item.open_information_requests;

  return (
    <li>
      <Link
        href={applicationReviewHref(item.id)}
        className={cn("group flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-neutral-50", focusRing)}
      >
        <div className="min-w-0 flex-1 md:flex md:items-start md:justify-between md:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-neutral-900">
                #{item.id} · {item.customer_name ?? "Unknown customer"}
              </p>
              {showStatus && <Badge variant="neutral">{staffStatusLabel(item.status)}</Badge>}
              {item.is_mine && <Badge variant="primary">Yours</Badge>}
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {formatKina(item.amount_requested)}
              {item.prime_category ? ` · ${item.prime_category}` : ""}
              {purpose ? ` · ${purpose}` : ""}
            </p>
            {openRequests > 0 && (
              <p className="mt-1 text-xs text-amber-800">
                {openRequests === 1 ? "1 open information request" : `${openRequests} open information requests`}
              </p>
            )}
            {item.returned_reason && (
              <p className="mt-1 text-xs text-amber-800">Returned: {item.returned_reason}</p>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-600 md:mt-0 md:shrink-0 md:flex-col md:items-end md:text-right">
            {item.submitted_at && <span>Submitted {formatDate(item.submitted_at)}</span>}
            {waiting && <span className="font-medium text-neutral-700">{waiting}</span>}
            <span>{assignmentLabel(item)}</span>
          </div>
        </div>
        <ChevronRight
          className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400 group-hover:text-primary"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
