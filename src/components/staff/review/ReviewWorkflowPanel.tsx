"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { claimApplication, resumeReview } from "@/lib/actions/review-workflow";
import { cn, focusRing } from "@/lib/utils";

const RESUME_REASON_MAX_LENGTH = 1000; // backend limit

interface ReviewWorkflowPanelProps {
  applicationId: number;
  // From the backend's allowed_actions - this panel never re-derives the rules.
  canClaim: boolean;
  canResume: boolean;
  status: string;
}

// The two state changes that unlock the rest of the review screen:
//   * Claim - takes a new application from the shared queue (it becomes
//     yours, the checklist opens).
//   * Resume review - brings an application back to "Under review", either
//     after an administrator returned it, or without waiting for the
//     customer (which cancels their open requests, so a reason is needed).
export function ReviewWorkflowPanel({ applicationId, canClaim, canResume, status }: ReviewWorkflowPanelProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waitingOnCustomer = status === "customer_action_required";

  if (!canClaim && !canResume) return null;

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    if (result.ok) {
      setReason("");
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

  return (
    <Card>
      {canClaim ? (
        <>
          <CardTitle>Start the review</CardTitle>
          <p className="mt-1 text-sm text-neutral-600">
            Claiming assigns this application to you and opens its verification checklist. Other officers can still
            see it, but only you or an administrator can work on it.
          </p>
          <Button className="mt-4" onClick={() => void run(() => claimApplication(applicationId))} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Claim and start review
          </Button>
        </>
      ) : (
        <>
          <CardTitle>Resume the review</CardTitle>
          <p className="mt-1 text-sm text-neutral-600">
            {waitingOnCustomer
              ? "Continue without waiting for the customer. Their open requests will be cancelled - they're kept in the history, but the customer can no longer answer them."
              : "The administrator returned this application. Resume to update the checks and send a new recommendation."}
          </p>
          {waitingOnCustomer && (
            <div className="mt-4">
              <label htmlFor="resume-reason" className="text-sm font-medium text-neutral-900">
                Reason
              </label>
              <textarea
                id="resume-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={RESUME_REASON_MAX_LENGTH}
                rows={3}
                className={cn("mt-1 w-full rounded-lg border border-neutral-300 p-3 text-sm", focusRing)}
                placeholder="e.g. Customer confirmed their employer by phone."
              />
            </div>
          )}
          <Button className="mt-4" variant="secondary" onClick={resume} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Resume review
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </Card>
  );
}
