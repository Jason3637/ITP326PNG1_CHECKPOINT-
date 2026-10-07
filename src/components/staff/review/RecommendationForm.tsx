"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronRight, Undo2, XCircle } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TabLink } from "@/components/ui/TabLink";
import { submitRecommendation } from "@/lib/actions/recommendations";
import { COMMENTS_MAX_LENGTH, RECOMMENDATION_COPY as COPY, validateRecommendation } from "@/lib/recommendations";
import { cn } from "@/lib/utils";
import type { OfficerRecommendationType } from "@/lib/types";

export interface ChecklistState {
  started: boolean;
  required: number;
  requiredComplete: number;
  outstanding: string[]; // labels
  failed: string[]; // labels
  ready: boolean; // backend's ready_for_approval_recommendation
  // How many checks are marked not applicable (counted from the items).
  notApplicable?: number;
}

// Where the application's information requests stand (from its rounds).
export interface RequestsState {
  rounds: number;
  open: number;
}

// The administrator's most recent return, when it hasn't been answered by
// a newer recommendation yet.
export interface ReturnState {
  by: string | null;
  at: string | null; // already formatted
  reason: string;
}

interface RecommendationFormProps {
  applicationId: number;
  customerName?: string;
  checklist: ChecklistState;
  requests?: RequestsState;
  returned?: ReturnState | null;
  canRecommendApproval: boolean;
  canRecommendRejection: boolean;
}

const OPTIONS: OfficerRecommendationType[] = ["recommend_approval", "recommend_rejection"];

// The officer's recommendation to an administrator - a recommendation only:
// the administrator decides, and nothing here says otherwise (all wording
// from RECOMMENDATION_COPY, checked against FORBIDDEN_RECOMMENDATION_WORDING).
//
// 1. A review summary of what will be recorded: the checklist as it stands
//    (the backend freezes it into the recommendation), problems, N/A,
//    information requests, and what's outstanding - with links to the checks.
// 2. The choice (a fieldset of radios) and the required comments.
// 3. "Review and send" checks exactly what it always did - approval needs
//    the backend's ready flag (COPY.approvalBlocked otherwise), then
//    validateRecommendation - and opens a confirmation dialog summarising
//    what's about to be sent. Only "Send to Administrator" there submits:
//    the same submitRecommendation(id, kind, comments) as before.
// Sending can't happen twice (a lock, as well as the disabled button); a
// refusal or a failed request closes the dialog and shows why, with the
// comments kept. The page then follows the existing redirect.
export function RecommendationForm({
  applicationId,
  customerName,
  checklist,
  requests,
  returned = null,
  canRecommendApproval,
  canRecommendRejection,
}: RecommendationFormProps) {
  const router = useRouter();
  const baseId = useId();
  const [kind, setKind] = useState<OfficerRecommendationType | "">("");
  const [comments, setComments] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendLock = useRef(false);

  const approvalAllowed = canRecommendApproval && checklist.ready;
  const options = OPTIONS.filter((k) => (k === "recommend_approval" ? canRecommendApproval : canRecommendRejection));

  function choose(k: OfficerRecommendationType) {
    setKind(k);
    setError(k === "recommend_approval" && !approvalAllowed ? COPY.approvalBlocked : null);
  }

  function review() {
    const invalid =
      kind === "recommend_approval" && !approvalAllowed ? COPY.approvalBlocked : validateRecommendation(kind, comments);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function send() {
    if (!kind || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setError(null);
    let result: Awaited<ReturnType<typeof submitRecommendation>>;
    try {
      result = await submitRecommendation(applicationId, kind, comments);
    } catch {
      // The request itself failed (offline, server unreachable): nothing
      // was sent. Say so instead of spinning forever.
      result = { ok: false, error: "Couldn't reach the server. Check your connection, then send again." };
    }
    if (result.ok) {
      router.replace(`/staff/applications/${applicationId}?recommended=${result.kind}`, { scroll: true });
      router.refresh();
    } else {
      sendLock.current = false;
      setSending(false);
      setConfirming(false);
      setError(result.error);
    }
  }

  const requestLine = !requests
    ? null
    : requests.rounds === 0
      ? "No information requested"
      : requests.open > 0
        ? `${requests.open} open - waiting on the customer`
        : `All answered (${requests.rounds === 1 ? "1 round" : `${requests.rounds} rounds`})`;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle id="recommendation" tabIndex={-1} className="scroll-mt-24 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {COPY.title}
        </CardTitle>
        <p className="mt-1 text-sm text-neutral-600">{COPY.intro}</p>
      </div>

      {returned && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-light/60 p-3 text-sm">
          <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-neutral-900">
              Returned by {returned.by ?? "the administrator"}
              {returned.at ? ` · ${returned.at}` : ""}
            </p>
            <p className="whitespace-pre-line text-neutral-800">{returned.reason}</p>
          </div>
        </div>
      )}

      <section aria-labelledby={`${baseId}-summary`} className="rounded-lg bg-neutral-50 p-3 text-sm">
        <h3 id={`${baseId}-summary`} className="sr-only">
          Review summary
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-neutral-900">
            Checklist: {checklist.requiredComplete} of {checklist.required} required checks done
          </p>
          {checklist.ready ? <Badge variant="success">Complete</Badge> : <Badge variant="warning">Incomplete</Badge>}
        </div>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-neutral-700">
          <dt>Problems</dt>
          <dd className={cn("font-medium", checklist.failed.length > 0 ? "text-red-700" : "text-neutral-900")}>
            {checklist.failed.length === 0 ? "None" : checklist.failed.length === 1 ? "1 problem" : `${checklist.failed.length} problems`}
          </dd>
          {checklist.notApplicable !== undefined && (
            <>
              <dt>Not applicable</dt>
              <dd className="font-medium text-neutral-900">{checklist.notApplicable} N/A</dd>
            </>
          )}
          {requestLine && (
            <>
              <dt>Information requests</dt>
              <dd className="font-medium text-neutral-900">{requestLine}</dd>
            </>
          )}
        </dl>
        {checklist.failed.length > 0 && <p className="mt-2 text-red-700">Problem found: {checklist.failed.join(", ")}</p>}
        {checklist.outstanding.length > 0 && <p className="mt-1 text-neutral-700">Outstanding: {checklist.outstanding.join(", ")}</p>}
        {(checklist.failed.length > 0 || checklist.outstanding.length > 0) && (
          <TabLink tab="verification" className="mt-1 inline-flex items-center gap-0.5">
            {checklist.outstanding.length + checklist.failed.length === 1
              ? "1 check to look at"
              : `${checklist.outstanding.length + checklist.failed.length} checks to look at`}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </TabLink>
        )}
        <p className="mt-2 text-xs text-neutral-600">{COPY.snapshotNote}</p>
      </section>

      <fieldset className="@container">
        <legend className="text-sm font-medium text-neutral-900">Your recommendation</legend>
        <div className="mt-2 grid gap-3 @lg:grid-cols-2">
          {options.map((k) => {
            const active = kind === k;
            const blocked = k === "recommend_approval" && !approvalAllowed;
            const Icon = k === "recommend_approval" ? CheckCircle2 : XCircle;
            const inputId = `${baseId}-${k}`;
            const helpId = `${inputId}-help`;
            return (
              <label
                key={k}
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                  active ? "border-primary bg-primary-light" : "border-neutral-200 hover:bg-neutral-50",
                  blocked && "opacity-60",
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`${baseId}-recommendation`}
                  value={k}
                  checked={active}
                  onChange={() => choose(k)}
                  aria-describedby={helpId}
                  className="sr-only"
                />
                <Icon
                  className={cn("mt-0.5 h-5 w-5 shrink-0", k === "recommend_approval" ? "text-success" : "text-danger")}
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-semibold text-neutral-900">{COPY.options[k].label}</span>
                  <span id={helpId} className="block text-xs text-neutral-600">
                    {blocked ? COPY.approvalBlocked : COPY.options[k].help}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="recommendation-comments" className="text-sm font-medium text-neutral-700">
          {COPY.commentsLabel} <span className="font-normal text-neutral-500">(required)</span>
        </label>
        <textarea
          id="recommendation-comments"
          rows={4}
          maxLength={COMMENTS_MAX_LENGTH}
          value={comments}
          onChange={(e) => {
            setComments(e.target.value);
            setError(null);
          }}
          placeholder={
            kind === "recommend_rejection"
              ? "e.g. Income can't be verified and the referee is unreachable."
              : "e.g. ID, employer and referee all confirmed; payslip current."
          }
          className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div>
        <Button onClick={review} aria-haspopup="dialog">
          {COPY.submit}
        </Button>
      </div>

      <Dialog
        open={confirming && !!kind}
        onClose={() => setConfirming(false)}
        dismissible={!sending}
        title={kind ? COPY.confirmTitle(kind) : COPY.title}
        description={COPY.confirmBody}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
              {COPY.back}
            </Button>
            <Button onClick={send} loading={sending}>
              {COPY.confirm}
            </Button>
          </>
        }
      >
        {kind && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-neutral-600">Application</dt>
            <dd className="font-medium text-neutral-900">
              #{applicationId}
              {customerName ? ` · ${customerName}` : ""}
            </dd>
            <dt className="text-neutral-600">Recommendation</dt>
            <dd className="font-medium text-neutral-900">{COPY.options[kind].label}</dd>
            <dt className="text-neutral-600">Required checks</dt>
            <dd className="font-medium tabular-nums text-neutral-900">
              {checklist.requiredComplete} / {checklist.required} complete
            </dd>
            <dt className="text-neutral-600">Problems</dt>
            <dd className={cn("font-medium", checklist.failed.length > 0 ? "text-red-700" : "text-neutral-900")}>
              {checklist.failed.length > 0 ? checklist.failed.join(", ") : "None"}
            </dd>
            <dt className="text-neutral-600">Your comments</dt>
            <dd className="whitespace-pre-line break-words text-neutral-900">{comments.trim()}</dd>
          </dl>
        )}
      </Dialog>
    </Card>
  );
}
