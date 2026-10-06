"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { WRITE_OFF_REASON_MAX_LENGTH } from "@/lib/admin-loans";

export type WriteOffResult = { ok: true } | { ok: false; error: string };

// POST /admin/loans/<id>/write-off {reason}. Closes an active/overdue loan
// as written off (defaulted), keeping what was still owed on its closure
// record. Permanent; audited with the reason.
export async function writeOffLoan(loanId: number, reason: string): Promise<WriteOffResult> {
  if (!Number.isInteger(loanId) || loanId <= 0) return { ok: false, error: "Unknown loan." };
  const clean = typeof reason === "string" ? reason.trim() : "";
  if (!clean) return { ok: false, error: "Give a reason for writing off this loan." };
  if (clean.length > WRITE_OFF_REASON_MAX_LENGTH) return { ok: false, error: `Keep the reason under ${WRITE_OFF_REASON_MAX_LENGTH} characters.` };
  try {
    await serverApiFetch(`/admin/loans/${loanId}/write-off`, { method: "POST", body: { reason: clean } });
    return { ok: true };
  } catch (err) {
    if (err instanceof UnauthenticatedError) return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    if (err instanceof ApiError) {
      if (err.status === 403) return { ok: false, error: "Only an administrator can write off a loan." };
      if (err.status === 409) {
        return /nothing outstanding/.test(err.message)
          ? { ok: false, error: "Nothing is owed on this loan any more, so there's nothing to write off." }
          : { ok: false, error: "This loan is already closed. Refresh to see its current state." };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't write off the loan. Try again." };
  }
}
