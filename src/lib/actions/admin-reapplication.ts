"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { CLEAR_REASON_MAX_LENGTH } from "@/lib/admin-loans";

export type ClearResult = { ok: true } | { ok: false; error: string };

// POST /admin/loans/<id>/clear-reapplication-block {reason}. Lets a customer
// whose loan was written off apply for PRIME again. Once per loan,
// permanent and audited - there's no way to undo it.
export async function clearReapplicationBlock(loanId: number, reason: string): Promise<ClearResult> {
  if (!Number.isInteger(loanId) || loanId <= 0) return { ok: false, error: "Unknown loan." };
  const clean = typeof reason === "string" ? reason.trim() : "";
  if (!clean) return { ok: false, error: "Give a reason for clearing this customer to apply again." };
  if (clean.length > CLEAR_REASON_MAX_LENGTH) return { ok: false, error: `Keep the reason under ${CLEAR_REASON_MAX_LENGTH} characters.` };
  try {
    await serverApiFetch(`/admin/loans/${loanId}/clear-reapplication-block`, { method: "POST", body: { reason: clean } });
    return { ok: true };
  } catch (err) {
    if (err instanceof UnauthenticatedError) return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    if (err instanceof ApiError) {
      if (err.status === 403) return { ok: false, error: "Only an administrator can clear a customer to apply again." };
      if (err.status === 409) {
        return /already been cleared/.test(err.message)
          ? { ok: false, error: "This loan has already been cleared. Refresh to see who cleared it." }
          : { ok: false, error: "This loan wasn't written off, so there's nothing to clear." };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't clear the customer. Try again." };
  }
}
