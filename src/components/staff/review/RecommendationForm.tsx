"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
}

interface RecommendationFormProps {
  applicationId: number;
  checklist: ChecklistState;
  canRecommendApproval: boolean;
  canRecommendRejection: boolean;
}

// Recommend approval / rejection. Two steps - choose and comment, then
// confirm - because a recommendation can't be edited once sent. The
// checklist state shown here is what the backend freezes into the
// recommendation; it updates live as checks are saved (the page refreshes
// after each save). All wording comes from RECOMMENDATION_COPY.
export function RecommendationForm({
  applicationId,
  checklist,
  canRecommendApproval,
  canRecommendRejection,
}: RecommendationFormProps) {
  const router = useRouter();
  const [kind, setKind] = useState<OfficerRecommendationType | "">("");
  const [comments, setComments] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvalAllowed = canRecommendApproval && checklist.ready;
  const options = (["recommend_approval", "recommend_rejection"] as const).filter((k) =>
    k === "recommend_approval" ? canRecommendApproval : canRecommendRejection,
  );

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
    if (!kind) return;
    setSending(true);
    setError(null);
    const result = await submitRecommendation(applicationId, kind, comments);
    if (result.ok) {
      router.replace(`/staff/applications/${applicationId}?recommended=${result.kind}`, { scroll: true });
      router.refresh();
    } else {
      setSending(false);
      setConfirming(false);
      setError(result.error);
    }
  }

  return (
    <Card>
      <CardTitle>{COPY.title}</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">{COPY.intro}</p>

      <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-neutral-900">
            Checklist: {checklist.requiredComplete} of {checklist.required} required checks done
          </p>
          {checklist.ready ? (
            <Badge variant="success">Complete</Badge>
          ) : (
            <Badge variant="warning">Incomplete</Badge>
          )}
        </div>
        {checklist.failed.length > 0 && (
          <p className="mt-1 text-red-700">Problem found: {checklist.failed.join(", ")}</p>
        )}
        {checklist.outstanding.length > 0 && (
          <p className="mt-1 text-neutral-700">Outstanding: {checklist.outstanding.join(", ")}</p>
        )}
        <p className="mt-1 text-xs text-neutral-600">{COPY.snapshotNote}</p>
      </div>

      {confirming && kind ? (
        <div className="mt-4 rounded-lg border border-neutral-300 p-4">
          <p className="font-semibold text-neutral-900">{COPY.confirmTitle(kind)}</p>
          <p className="mt-1 text-sm text-neutral-700">{COPY.confirmBody}</p>
          <p className="mt-3 text-xs font-medium text-neutral-600">Your comments</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-neutral-900">{comments.trim()}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={send} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {COPY.confirm}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
              {COPY.back}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Recommendation" className="mt-4 grid gap-3 sm:grid-cols-2">
            {options.map((k) => {
              const active = kind === k;
              const blocked = k === "recommend_approval" && !approvalAllowed;
              const Icon = k === "recommend_approval" ? CheckCircle2 : XCircle;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-disabled={blocked}
                  onClick={() => {
                    setKind(k);
                    setError(blocked ? COPY.approvalBlocked : null);
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "border-primary bg-primary-light" : "border-neutral-200 hover:bg-neutral-50",
                    blocked && "opacity-60",
                  )}
                >
                  <Icon
                    className={cn("mt-0.5 h-5 w-5 shrink-0", k === "recommend_approval" ? "text-success" : "text-danger")}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{COPY.options[k].label}</span>
                    <span className="block text-xs text-neutral-600">
                      {blocked ? COPY.approvalBlocked : COPY.options[k].help}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
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

          <div className="mt-4">
            <Button onClick={review}>{COPY.submit}</Button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </Card>
  );
}
