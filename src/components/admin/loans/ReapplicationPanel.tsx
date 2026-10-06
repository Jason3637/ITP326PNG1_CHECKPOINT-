"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { clearReapplicationBlock } from "@/lib/actions/admin-reapplication";
import { CLEAR_REASON_MAX_LENGTH } from "@/lib/admin-loans";
import { formatReviewDateTime } from "@/lib/application-review";
import type { AdminLoanDetail } from "@/lib/types";

// For a written-off loan: whether it still stops the customer applying for
// PRIME, and the "Clear to apply again" action while it does. Clearing is
// once per loan, permanent and audited, so it takes a reason and a confirm
// step; the button locks on the first click.
export function ReapplicationPanel({ loanId, reapplication }: { loanId: number; reapplication: NonNullable<AdminLoanDetail["reapplication"]> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  if (!reapplication.blocked) {
    return (
      <Card>
        <CardTitle>Applying again</CardTitle>
        <div className="mt-3 flex items-start gap-2 text-sm text-neutral-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p>
              Cleared to apply again
              {reapplication.cleared_at ? ` on ${formatReviewDateTime(reapplication.cleared_at)}` : ""}
              {reapplication.cleared_by_name ? ` by ${reapplication.cleared_by_name}` : ""}.
            </p>
            {reapplication.reason && <p className="mt-1 whitespace-pre-line text-neutral-900">“{reapplication.reason}”</p>}
          </div>
        </div>
      </Card>
    );
  }

  async function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    const result = await clearReapplicationBlock(loanId, reason);
    if (result.ok) {
      router.replace(`/admin/loans/${loanId}?cleared=1`, { scroll: true });
      router.refresh();
    } else {
      inFlight.current = false;
      setSending(false);
      setConfirming(false);
      setError(result.error);
    }
  }

  return (
    <Card>
      <CardTitle>Applying again</CardTitle>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <p>This loan was written off, so the customer can&apos;t apply for a new PRIME loan until you clear them.</p>
      </div>

      {!open ? (
        <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          Clear to apply again
        </Button>
      ) : confirming ? (
        <div className="mt-4 rounded-lg border border-neutral-300 p-4">
          <p className="font-semibold text-neutral-900">Clear this customer to apply again?</p>
          <p className="mt-1 text-sm text-neutral-700">
            They&apos;ll be able to apply for a new PRIME loan. This is recorded with your reason and can&apos;t be undone.
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-neutral-900">“{reason.trim()}”</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={send} disabled={sending} aria-busy={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Clear to apply again
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="clear-reason" className="text-sm font-medium text-neutral-700">
            Why can they apply again? <span className="font-normal text-neutral-500">(required)</span>
          </label>
          <textarea
            id="clear-reason"
            rows={3}
            required
            maxLength={CLEAR_REASON_MAX_LENGTH}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Reviewed with the member on Oct 6; the debt was settled outside the system."
            className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => setConfirming(true)} disabled={!reason.trim()}>
              Review
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setReason("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
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
