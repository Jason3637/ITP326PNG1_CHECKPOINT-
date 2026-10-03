"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";

export type ReverifyResult = { ok: true } | { ok: false; error: string };

// POST /officer/applications/<id>/customer-verification/invalidate - the
// staff-requested re-verification trigger: the backend invalidates the
// customer's current verification (reason staff_requested) and re-opens this
// application's Age 18+ / Valid ID checks so they're done again.
export async function requestReverification(applicationId: number, note: string): Promise<ReverifyResult> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) return { ok: false, error: "Unknown application." };
  const trimmed = typeof note === "string" ? note.trim() : "";
  if (!trimmed) return { ok: false, error: "Say why the customer needs re-verifying." };
  if (trimmed.length > 1000) return { ok: false, error: "Keep the reason under 1000 characters." };
  try {
    await serverApiFetch(`/officer/applications/${applicationId}/customer-verification/invalidate`, {
      method: "POST",
      body: { note: trimmed },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      if (err.status === 403) return { ok: false, error: "Only the assigned officer or an administrator can do this." };
      if (err.status === 409) return { ok: false, error: "This customer has no current verification. Refresh the page." };
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't request re-verification. Try again." };
  }
}
