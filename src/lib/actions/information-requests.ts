"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { REQUEST_LIMITS, validateRequestDraft, type RequestDraft } from "@/lib/information-requests";

export type RequestInformationResult = { ok: true; requestCount: number } | { ok: false; error: string };

// POST /loans/applications/<id>/request-action - one round of Request More
// Information: each draft becomes its own InformationRequest the customer
// must answer, and the application moves OFFICER_REVIEW ->
// CUSTOMER_ACTION_REQUIRED. Earlier rounds are never touched. The backend
// enforces assignment (assigned officer or admin), status and every field
// limit; validation here just catches mistakes before the round trip.
export async function requestMoreInformation(
  applicationId: number,
  drafts: RequestDraft[],
): Promise<RequestInformationResult> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) return { ok: false, error: "Unknown application." };
  if (!Array.isArray(drafts) || drafts.length === 0) return { ok: false, error: "Add at least one request." };
  if (drafts.length > REQUEST_LIMITS.perRound) {
    return { ok: false, error: `Send at most ${REQUEST_LIMITS.perRound} requests at once.` };
  }
  if (drafts.some((d) => Object.keys(validateRequestDraft(d)).length > 0)) {
    return { ok: false, error: "Fix the highlighted fields first." };
  }

  try {
    await serverApiFetch(`/loans/applications/${applicationId}/request-action`, {
      method: "POST",
      body: {
        requests: drafts.map((d) => ({
          request_type: d.request_type,
          reason: d.reason.trim(),
          required_document_type: d.required_document_type || undefined,
          required_information: d.required_information.trim() || undefined,
          internal_note: d.internal_note.trim() || undefined,
        })),
      },
    });
    return { ok: true, requestCount: drafts.length };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return { ok: false, error: "Only the assigned officer or an administrator can request information." };
      }
      if (err.status === 409) {
        return { ok: false, error: "This application isn't under review any more. Refresh to see where it is." };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't send the request. Try again." };
  }
}
