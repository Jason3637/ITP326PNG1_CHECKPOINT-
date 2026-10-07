import { MessageSquareReply } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DocumentViewButton } from "./DocumentViewButton";
import { formatReviewDateTime } from "@/lib/application-review";
import { describeFieldChanges, groupIntoRounds, requestTypeLabel, requiredItems } from "@/lib/information-requests";
import { statusPresentation } from "@/lib/status-presentation";
import type { ReviewInformationRequest } from "@/lib/types";

// One request in a round: what was asked, its state, the staff note, the
// customer's reply or why it was cancelled. Also used by the officer's
// rounds view (workspace/RequestRounds).
export function RequestItem({ r }: { r: ReviewInformationRequest }) {
  const status = statusPresentation("informationRequest", r.status);
  const items = requiredItems(r);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-neutral-900">{requestTypeLabel(r.request_type)}</p>
        <Badge variant={status.tone}>{status.label}</Badge>
        <span className="text-xs text-neutral-500">#{r.id}</span>
      </div>
      <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{r.reason}</p>
      {items.length > 0 && (
        <ul className="mt-1 text-xs text-neutral-600">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {r.internal_note && (
        <p className="mt-2 rounded bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
          <span className="font-medium">Internal note (staff only):</span> {r.internal_note}
        </p>
      )}

      {r.response && (
        <div className="mt-2 border-l-2 border-success pl-3">
          <p className="flex items-center gap-1 text-xs font-medium text-neutral-700">
            <MessageSquareReply className="h-3.5 w-3.5" aria-hidden="true" />
            Customer replied {formatReviewDateTime(r.response.responded_at) ?? ""}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-neutral-900">{r.response.response_note}</p>
        </div>
      )}
      {r.status === "cancelled" && (
        <p className="mt-2 text-xs text-neutral-600">
          Cancelled {formatReviewDateTime(r.cancelled_at) ?? ""}
          {r.cancel_reason ? `: ${r.cancel_reason}` : ""}
        </p>
      )}
    </li>
  );
}

// What the customer sent with a round's answers: the documents they
// uploaded and the application details they changed. The backend copies the
// same set onto every response in the round, so it's shown once per round.
export function RoundResponse({ requests }: { requests: ReviewInformationRequest[] }) {
  const changes = describeFieldChanges(requests.find((r) => r.response?.field_changes)?.response?.field_changes);
  const docIds = [...new Set(requests.flatMap((r) => r.response?.provided_document_ids ?? []))];
  return (
    <>
    {docIds.length > 0 && (
      <div className="mt-2 rounded bg-neutral-50 p-2">
        <p className="text-xs font-medium text-neutral-700">Documents the customer provided in this response</p>
        <ul className="mt-1 flex flex-col gap-1">
          {docIds.map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 text-xs text-neutral-700">
              <span>Document #{id}</span>
              <DocumentViewButton documentId={id} />
            </li>
          ))}
        </ul>
      </div>
    )}
    {changes.length > 0 && (
      <div className="mt-2 rounded bg-neutral-50 p-2">
        <p className="text-xs font-medium text-neutral-700">Details the customer changed in this response</p>
        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-700">
          {changes.map((c) => (
            <li key={c.label}>
              {c.label}: <span className="line-through decoration-neutral-400">{c.from}</span> → {c.to}
            </li>
          ))}
        </ul>
      </div>
    )}
    </>
  );
}

// Every Request More Information round on this application and every
// customer response, oldest first - nothing is collapsed to "the latest",
// since each round is evidence of what was asked and what came back.
// Documents and field changes belong to the customer's whole submission -
// the backend copies the same set onto every response in the round - so
// they're shown once per round, not repeated under each request.
export function RequestHistoryPanel({ requests }: { requests: ReviewInformationRequest[] }) {
  const rounds = groupIntoRounds(requests);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Information requests</CardTitle>
        <Badge variant="neutral">
          {rounds.length} {rounds.length === 1 ? "round" : "rounds"}
        </Badge>
      </div>

      {rounds.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">No information has been requested on this application.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-4">
          {rounds.map((round, i) => {
            const requester = round.requests[0]?.requested_by_name;
            return (
              <li key={round.requestedAt ?? i} className="rounded-lg border border-neutral-200 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Round {i + 1}
                  <span className="font-normal normal-case tracking-normal">
                    {" "}
                    · {formatReviewDateTime(round.requestedAt) ?? "date unknown"}
                    {requester ? ` · by ${requester}` : ""}
                  </span>
                </p>
                <ul className="divide-y divide-neutral-100">
                  {round.requests.map((r) => (
                    <RequestItem key={r.id} r={r} />
                  ))}
                </ul>
                <RoundResponse requests={round.requests} />
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
