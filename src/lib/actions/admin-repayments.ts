"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { REJECT_REASON_MAX_LENGTH } from "@/lib/admin-loans";

export type RepaymentDecisionResult = { ok: true; decision: "verified" | "rejected" } | { ok: false; error: string };

function failure(err: unknown, fallback: string): RepaymentDecisionResult {
  if (err instanceof UnauthenticatedError) {
    return { ok: false, error: "Your session expired. Refresh the page and log in again." };
  }
  if (err instanceof ApiError) {
    if (err.status === 403) return { ok: false, error: "Only an administrator can verify or reject a repayment." };
    if (err.status === 404) return { ok: false, error: "This payment no longer exists." };
    if (err.status === 409) {
      if (/more than the/.test(err.message)) {
        return {
          ok: false,
          error: "This payment is more than the loan's outstanding balance, so it can't be verified. Reject it with a reason so the customer can report the right amount.",
        };
      }
      if (/nothing is owed/.test(err.message)) return { ok: false, error: "This loan is closed; nothing is owed on it." };
      return { ok: false, error: "This payment has already been verified or rejected. Refresh to see its current state." };
    }
    return { ok: false, error: customerSafeMessage(err) };
  }
  return { ok: false, error: fallback };
}

// POST /admin/repayments/<id>/verify {note?}. One backend transaction:
// payment VERIFIED, a verified-repayment ledger entry, and - if that clears
// the balance - the loan's closure. Verifying twice is refused (409) by the
// backend; the workspace also never offers it.
export async function verifyRepayment(paymentId: number, note: string): Promise<RepaymentDecisionResult> {
  if (!Number.isInteger(paymentId) || paymentId <= 0) return { ok: false, error: "Unknown payment." };
  const clean = typeof note === "string" ? note.trim() : "";
  if (clean.length > REJECT_REASON_MAX_LENGTH) return { ok: false, error: `Keep the note under ${REJECT_REASON_MAX_LENGTH} characters.` };
  try {
    await serverApiFetch(`/admin/repayments/${paymentId}/verify`, { method: "POST", body: clean ? { note: clean } : {} });
    return { ok: true, decision: "verified" };
  } catch (err) {
    return failure(err, "Couldn't verify the payment. Try again.");
  }
}

// POST /admin/repayments/<id>/reject {reason}. No ledger entry is written.
export async function rejectRepayment(paymentId: number, reason: string): Promise<RepaymentDecisionResult> {
  if (!Number.isInteger(paymentId) || paymentId <= 0) return { ok: false, error: "Unknown payment." };
  const clean = typeof reason === "string" ? reason.trim() : "";
  if (!clean) return { ok: false, error: "Give a reason for rejecting this payment." };
  if (clean.length > REJECT_REASON_MAX_LENGTH) return { ok: false, error: `Keep the reason under ${REJECT_REASON_MAX_LENGTH} characters.` };
  try {
    await serverApiFetch(`/admin/repayments/${paymentId}/reject`, { method: "POST", body: { reason: clean } });
    return { ok: true, decision: "rejected" };
  } catch (err) {
    return failure(err, "Couldn't reject the payment. Try again.");
  }
}
