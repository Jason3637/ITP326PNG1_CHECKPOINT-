"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { isChecklistStatus, pickChecklist, validateChecklistDraft } from "@/lib/checklist";
import type { ChecklistItemStatus, ReviewChecklist } from "@/lib/types";

export type ChecklistUpdateResult = { ok: true; checklist: ReviewChecklist } | { ok: false; error: string };

// PATCH /officer/applications/<id>/checklist/<item_type> - ONE item per
// call, saved immediately, so progress is never held back for a final
// submit. The backend enforces everything that matters (assigned officer
// or admin only, editable statuses only, note required for failed/N-A)
// and audit-logs the before/after of each change; the checks here only
// stop obviously malformed requests early.
export async function updateChecklistItem(
  applicationId: number,
  itemType: string,
  status: ChecklistItemStatus,
  note: string,
): Promise<ChecklistUpdateResult> {
  if (!Number.isInteger(applicationId) || applicationId <= 0 || !/^[a-z0-9_]+$/.test(itemType)) {
    return { ok: false, error: "Unknown checklist item." };
  }
  if (!isChecklistStatus(status)) return { ok: false, error: "Unknown status." };
  const invalid = validateChecklistDraft(status, typeof note === "string" ? note : "");
  if (invalid) return { ok: false, error: invalid };

  try {
    const checklist = await serverApiFetch<ReviewChecklist>(
      `/officer/applications/${applicationId}/checklist/${itemType}`,
      { method: "PATCH", body: { status, note: note.trim() || undefined } },
    );
    return { ok: true, checklist: pickChecklist(checklist) };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return { ok: false, error: "Only the assigned officer or an administrator can update these checks." };
      }
      if (err.status === 409) {
        return { ok: false, error: "This application isn't open for checks any more. Refresh to see where it is." };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't save this check. Try again." };
  }
}
