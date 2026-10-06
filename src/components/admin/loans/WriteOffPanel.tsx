"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { writeOffLoan } from "@/lib/actions/admin-write-off";
import { WRITE_OFF_REASON_MAX_LENGTH } from "@/lib/admin-loans";
import { formatKina } from "@/lib/utils";

// Write off an active or overdue loan. Permanent, so it's tucked behind a
// button, needs a reason and a confirm step, and the confirm locks on the
// first click. The page only offers it when the backend would accept it.
export function WriteOffPanel({ loanId, outstanding }: { loanId: number; outstanding: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    const result = await writeOffLoan(loanId, reason);
    if (result.ok) {
      router.replace(`/admin/loans/${loanId}?written_off=1`, { scroll: true });
      router.refresh();
    } else {
      inFlight.current = false;
      setSending(false);
      setConfirming(false);
      setError(result.error);
    }
  }

  return (
    <Card className="border-danger/30">
      <CardTitle>Write off</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">
        For a loan that won&apos;t be repaid. It closes the loan as written off, keeps what was still owed on record, and
        can&apos;t be undone.
      </p>

      {!open ? (
        <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          Write off this loan
        </Button>
      ) : confirming ? (
        <div className="mt-4 rounded-lg border border-danger/40 p-4">
          <p className="font-semibold text-neutral-900">Write off loan #{loanId}?</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
            <li>It closes as written off with {formatKina(outstanding)} still owed.</li>
            <li>The customer can&apos;t apply for a new PRIME loan until you clear them to apply again.</li>
            <li>This is recorded with your reason and can&apos;t be undone.</li>
          </ul>
          <p className="mt-2 whitespace-pre-line text-sm text-neutral-900">“{reason.trim()}”</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" onClick={send} disabled={sending} aria-busy={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Write off loan
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="write-off-reason" className="text-sm font-medium text-neutral-700">
            Why is it being written off? <span className="font-normal text-neutral-500">(required)</span>
          </label>
          <textarea
            id="write-off-reason"
            rows={3}
            required
            maxLength={WRITE_OFF_REASON_MAX_LENGTH}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder="e.g. 60 days overdue; the member can't be reached and the referee confirms they've left the area."
            className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setConfirming(true)} disabled={!reason.trim()}>
              Review write-off
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
