"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";

export type WorkflowResult = { ok: true } | { ok: false; error: string };

// Mirrors the backend limit (resume-review reason, max 1000).
const RESUME_REASON_MAX_LENGTH = 1000;

const SESSION_EXPIRED = "Your session expired. Refresh the page and log in again.";

// POST /loans/applications/<id>/officer-review - claims a SUBMITTED
// application from the shared queue: the backend assigns it to the caller
// (assigned_officer_id), opens the verification checklist and moves it to
// OFFICER_REVIEW. Every later officer action depends on this claim.
export async function claimApplication(applicationId: number): Promise<WorkflowResult> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) return { ok: false, error: "Unknown application." };
  try {
    await serverApiFetch(`/loans/applications/${applicationId}/officer-review`, { method: "POST" });
    return { ok: true };
  } catch (err) {
    if (err instanceof UnauthenticatedError) return { ok: false, error: SESSION_EXPIRED };
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return { ok: false, error: "Someone has already claimed this application. Refresh to see who." };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't claim the application. Try again." };
  }
}

// POST /loans/applications/<id>/resume-review - back to OFFICER_REVIEW from
// either CUSTOMER_ACTION_REQUIRED (without waiting for the customer: the
// backend cancels every open request, so a reason is required) or
// RETURNED_TO_OFFICER (after an administrator sent it back; reason optional).
export async function resumeReview(applicationId: number, reason: string): Promise<WorkflowResult> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) return { ok: false, error: "Unknown application." };
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (trimmed.length > RESUME_REASON_MAX_LENGTH) {
    return { ok: false, error: `Keep the reason under ${RESUME_REASON_MAX_LENGTH} characters.` };
  }
  try {
    await serverApiFetch(`/loans/applications/${applicationId}/resume-review`, {
      method: "POST",
      body: { reason: trimmed || undefined },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof UnauthenticatedError) return { ok: false, error: SESSION_EXPIRED };
    if (err instanceof ApiError) {
      if (err.status === 400) {
        return { ok: false, error: "Give a reason - resuming cancels the customer's open requests." };
      }
      if (err.status === 403) {
        return { ok: false, error: "Only the assigned officer or an administrator can resume this review." };
      }
      if (err.status === 409) {
        return { ok: false, error: "This application has already moved on. Refresh to see where it is." };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't resume the review. Try again." };
  }
}
