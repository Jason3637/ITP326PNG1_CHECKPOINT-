"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn, focusRing } from "@/lib/utils";
import { claimApplication, resumeReview } from "@/lib/actions/review-workflow";

const RESUME_REASON_MAX_LENGTH = 1000; // backend limit

interface ReviewWorkflowPanelProps {
  applicationId: number;
  // From the backend's allowed_actions - this panel never re-derives the rules.
  canClaim: boolean;
  canResume: boolean;
  status: string;
  // The workspace heading, focused once a claim or resume has gone through
  // and the refreshed screen no longer offers it.
  focusTargetId?: string;
}

// The two state changes that unlock the rest of the review screen, as a
// compact banner above the workspace:
//   * Claim - takes a new application from the shared queue (it becomes
//     yours, the checklist opens).
//   * Resume review - brings an application back to "Under review", either
//     after an administrator returned it, or without waiting for the
//     customer (which cancels their open requests, so a reason is needed).
export function ReviewWorkflowPanel({ applicationId, canClaim, canResume, status, focusTargetId }: ReviewWorkflowPanelProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const succeeded = useRef(false);
  const waitingOnCustomer = status === "customer_action_required";
  const offered = canClaim || canResume;

  // The refresh after a claim drops this banner (the backend no longer
  // offers it); take the officer to the workspace it opened.
  useEffect(() => {
    if (!offered && succeeded.current && focusTargetId) {
      succeeded.current = false;
      document.getElementById(focusTargetId)?.focus();
    }
  }, [offered, focusTargetId]);

  if (!offered) return null;

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    if (result.ok) {
      setReason("");
      succeeded.current = true;
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  function resume() {
    if (waitingOnCustomer && !reason.trim()) {
      setError("Give a reason - resuming cancels the customer's open requests.");
      return;
    }
    void run(() => resumeReview(applicationId, reason));
  }

  const Icon = canClaim ? PlayCircle : RotateCcw;

  return (
    <section
      aria-labelledby="workflow-heading"
      className="rounded-xl border border-primary/40 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 id="workflow-heading" className="font-semibold text-neutral-900">
              {canClaim ? "Start the review" : "Resume the review"}
            </h3>
            <p className="mt-0.5 text-sm text-neutral-600">
              {canClaim
                ? "Claiming assigns this application to you and opens its verification checklist. Other officers can still see it, but only you or an administrator can work on it."
                : waitingOnCustomer
                  ? "Continue without waiting for the customer. Their open requests will be cancelled - they're kept in the history, but the customer can no longer answer them."
                  : "The administrator returned this application. Resume to update the checks and send a new recommendation."}
            </p>
          </div>
        </div>
        {(canClaim || !waitingOnCustomer) && (
          <Button
            className="shrink-0"
            variant={canClaim ? "primary" : "secondary"}
            loading={busy}
            onClick={canClaim ? () => void run(() => claimApplication(applicationId)) : resume}
          >
            {canClaim ? "Claim and start review" : "Resume review"}
          </Button>
        )}
      </div>

      {!canClaim && waitingOnCustomer && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:pl-8">
          <div className="min-w-0 flex-1">
            <label htmlFor="resume-reason" className="text-sm font-medium text-neutral-900">
              Reason
            </label>
            <textarea
              id="resume-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={RESUME_REASON_MAX_LENGTH}
              rows={2}
              className={cn("mt-1 w-full rounded-lg border border-neutral-300 p-3 text-sm", focusRing)}
              placeholder="e.g. Customer confirmed their employer by phone."
            />
          </div>
          <Button className="shrink-0" variant="secondary" loading={busy} onClick={resume}>
            Resume review
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 sm:pl-8">
          {error}
        </p>
      )}
    </section>
  );
}
