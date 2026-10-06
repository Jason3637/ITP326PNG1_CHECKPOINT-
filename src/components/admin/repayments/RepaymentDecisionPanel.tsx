"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Lock, XCircle } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { rejectRepayment, verifyRepayment } from "@/lib/actions/admin-repayments";
import { REJECT_REASON_MAX_LENGTH, canDecidePayment, paymentStatus } from "@/lib/admin-loans";
import { cn, formatKina } from "@/lib/utils";
import type { AdminPaymentStatus } from "@/lib/types";

interface RepaymentDecisionPanelProps {
  paymentId: number;
  loanId: number;
  status: AdminPaymentStatus; // the backend's current status for this payment
  amount: number;
  outstanding: number; // the loan's current outstanding, from the ledger
}

type Choice = "verify" | "reject";

// Verify / Reject a reported repayment. Offered only while the backend's
// status still allows it (reported or verification pending); once it's
// verified or rejected the actions are shown disabled with the reason. The
// confirm button locks on the first click (state and a ref) until the
// backend answers - and the backend refuses a second verification anyway.
export function RepaymentDecisionPanel({ paymentId, loanId, status, amount, outstanding }: RepaymentDecisionPanelProps) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | "">("");
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const open = canDecidePayment(status);
  const overpays = amount > outstanding;

  if (!open) {
    const s = paymentStatus(status);
    return (
      <Card>
        <CardTitle>Verify or reject</CardTitle>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <p>This payment is already {s.label.toLowerCase()}. It can&apos;t be verified or rejected again.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled>Verify payment</Button>
          <Button variant="danger" disabled>
            Reject payment
          </Button>
        </div>
      </Card>
    );
  }

  const canReview = choice === "verify" || (choice === "reject" && text.trim().length > 0);

  async function send() {
    if (!choice || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    const result = choice === "verify" ? await verifyRepayment(paymentId, text) : await rejectRepayment(paymentId, text);
    if (result.ok) {
      // Stays locked: the page reloads with the backend's new status.
      router.replace(`/admin/loans/${loanId}/repayments/${paymentId}?done=${result.decision}`, { scroll: true });
      router.refresh();
    } else {
      inFlight.current = false;
      setSending(false);
      setConfirming(false);
      setError(result.error);
    }
  }

  return (
    <Card variant="emphasis">
      <CardTitle>Verify or reject</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">
        Check the receipt and reference against the bank or cash record before deciding.
      </p>
      {overpays && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-light/50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This payment ({formatKina(amount)}) is more than the {formatKina(outstanding)} outstanding. Verifying it will be
          refused; reject it with a reason so the customer can report the right amount.
        </p>
      )}

      {confirming && choice ? (
        <div className="mt-4 rounded-lg border border-neutral-300 p-4">
          <p className="font-semibold text-neutral-900">
            {choice === "verify" ? `Verify ${formatKina(amount)}?` : "Reject this payment?"}
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            {choice === "verify"
              ? "It's added to the loan's ledger and reduces the outstanding balance. If it clears the balance, the loan closes as paid in full. This can't be undone."
              : "Nothing is added to the ledger. The customer can report the payment again with the right details."}
          </p>
          {text.trim() && (
            <p className="mt-2 whitespace-pre-line text-sm text-neutral-900">
              <span className="text-xs font-medium text-neutral-600">{choice === "verify" ? "Note: " : "Reason: "}</span>
              {text.trim()}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant={choice === "reject" ? "danger" : "primary"} onClick={send} disabled={sending} aria-busy={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {choice === "verify" ? "Verify payment" : "Reject payment"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Decision" className="mt-4 grid gap-2 sm:grid-cols-2">
            {(["verify", "reject"] as const).map((c) => {
              const Icon = c === "verify" ? CheckCircle2 : XCircle;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={choice === c}
                  onClick={() => {
                    setChoice(c);
                    setError(null);
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    choice === c ? "border-primary bg-primary-light" : "border-neutral-200 hover:bg-neutral-50",
                  )}
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", c === "verify" ? "text-success" : "text-danger")} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{c === "verify" ? "Verify" : "Reject"}</span>
                    <span className="block text-xs text-neutral-600">
                      {c === "verify" ? "The money was received as reported." : "It doesn't match. A reason is required."}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {choice && (
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="repayment-text" className="text-sm font-medium text-neutral-700">
                {choice === "verify" ? "Note" : "Reason for rejecting"}{" "}
                <span className="font-normal text-neutral-500">({choice === "verify" ? "optional" : "required"})</span>
              </label>
              <textarea
                id="repayment-text"
                rows={3}
                maxLength={REJECT_REASON_MAX_LENGTH}
                required={choice === "reject"}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                placeholder={
                  choice === "reject" ? "e.g. No BSP transaction with this reference on Oct 3." : "e.g. Matched on the BSP statement."
                }
                className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          )}

          <div className="mt-4">
            <Button onClick={() => setConfirming(true)} disabled={!canReview}>
              Review decision
            </Button>
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
