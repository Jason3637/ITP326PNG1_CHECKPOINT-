import { ChevronRight } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { CompactEmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RequestItem, RoundResponse } from "@/components/staff/review/RequestHistoryPanel";
import { formatReviewDateTime } from "@/lib/application-review";
import { groupIntoRounds, type RequestRound } from "@/lib/information-requests";
import { statusPresentation } from "@/lib/status-presentation";
import type { InformationRequestStatus, ReviewInformationRequest } from "@/lib/types";

// "2 answered · 1 waiting" for a round, in the request statuses' own words.
function roundSummary(round: RequestRound<ReviewInformationRequest>) {
  const count = (s: InformationRequestStatus) => round.requests.filter((r) => r.status === s).length;
  const parts: { status: InformationRequestStatus; n: number }[] = (["open", "responded", "cancelled"] as const)
    .map((status) => ({ status, n: count(status) }))
    .filter((p) => p.n > 0);
  return parts;
}

function latestResponse(round: RequestRound<ReviewInformationRequest>): string | null {
  const times = round.requests.map((r) => r.response?.responded_at).filter((t): t is string => !!t);
  return times.length ? times.sort().at(-1)! : null;
}

function RoundHeader({ round, n }: { round: RequestRound<ReviewInformationRequest>; n: number }) {
  const requester = round.requests[0]?.requested_by_name;
  const responded = latestResponse(round);
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-sm font-semibold text-neutral-900">Round {n}</span>
      <span className="text-xs text-neutral-600">
        Requested {formatReviewDateTime(round.requestedAt) ?? "date unknown"}
        {requester ? ` by ${requester}` : ""}
        {responded ? ` · answered ${formatReviewDateTime(responded)}` : ""}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {roundSummary(round).map(({ status, n: count }) => {
          const p = statusPresentation("informationRequest", status);
          return (
            <StatusBadge key={status} tone={p.tone} icon={p.icon}>
              {count} {p.label.toLowerCase()}
            </StatusBadge>
          );
        })}
      </span>
    </span>
  );
}

function RoundBody({ round }: { round: RequestRound<ReviewInformationRequest> }) {
  return (
    <>
      <ul className="divide-y divide-neutral-100">
        {round.requests.map((r) => (
          <RequestItem key={r.id} r={r} />
        ))}
      </ul>
      <RoundResponse requests={round.requests} />
    </>
  );
}

// The officer's information-request history: every round, newest first as a
// timeline. The latest round is open; older ones are folded into
// disclosures (still in the page, one click to open) - nothing is dropped:
// every request, reply, staff note, cancellation, document and change.
export function RequestRounds({ requests }: { requests: ReviewInformationRequest[] }) {
  const rounds = groupIntoRounds(requests);
  const latest = rounds.length;

  return (
    <Card id="request-rounds" className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Information requests</CardTitle>
        <span className="text-sm text-neutral-600">{rounds.length === 1 ? "1 round" : `${rounds.length} rounds`}</span>
      </div>

      {rounds.length === 0 ? (
        <CompactEmptyState>No information has been requested on this application.</CompactEmptyState>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-neutral-200 pl-4">
          {[...rounds].reverse().map((round, i) => {
            const n = latest - i;
            return (
              <li key={round.requestedAt ?? n} className="relative">
                <span className="absolute -left-5.75 top-3 h-3 w-3 rounded-full border-2 border-white bg-neutral-400" aria-hidden="true" />
                {i === 0 ? (
                  <div className="rounded-lg border border-neutral-200 p-3 sm:p-4">
                    <RoundHeader round={round} n={n} />
                    <RoundBody round={round} />
                  </div>
                ) : (
                  <details className="group rounded-lg border border-neutral-200">
                    <summary className="flex cursor-pointer items-start gap-2 rounded-lg p-3 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
                      <RoundHeader round={round} n={n} />
                    </summary>
                    <div className="border-t border-neutral-100 px-3 pb-3 sm:px-4">
                      <RoundBody round={round} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
