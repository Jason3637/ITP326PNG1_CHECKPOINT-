"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { isAdminDecision, outcomeFor, validateDecision, type DecisionOutcome } from "@/lib/admin-decisions";
import type { OfficerRecommendationType } from "@/lib/types";

export type DecisionResult = { ok: true; outcome: DecisionOutcome } | { ok: false; error: string };

// The administrator's final-review actions:
//   approve -> POST /admin/applications/<id>/approve {note?}
//             AWAITING_DISBURSEMENT only - no loan, no disbursement.
//   reject  -> POST /admin/applications/<id>/reject {reason}
//   return  -> POST /admin/applications/<id>/return-to-officer {reason}
// The required-text rules are checked here too, and the backend enforces
// them again.
export async function decideApplication(
  applicationId: number,
  decision: "approve" | "reject" | "return",
  text: string,
  latestRecommendation: OfficerRecommendationType | null,
): Promise<DecisionResult> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) return { ok: false, error: "Unknown application." };
  if (!isAdminDecision(decision)) return { ok: false, error: "Choose approve, reject or return." };
  const body = typeof text === "string" ? text.trim() : "";
  const invalid = validateDecision(decision, body, latestRecommendation);
  if (invalid) return { ok: false, error: invalid };

  const path =
    decision === "approve" ? "approve" : decision === "reject" ? "reject" : "return-to-officer";
  try {
    await serverApiFetch(`/admin/applications/${applicationId}/${path}`, {
      method: "POST",
      body: decision === "approve" ? (body ? { note: body } : {}) : { reason: body },
    });
    return { ok: true, outcome: outcomeFor(decision) };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      if (err.status === 403) return { ok: false, error: "Only an administrator can make the final decision." };
      if (err.status === 404) return { ok: false, error: "This application no longer exists." };
      if (err.status === 409) {
        return {
          ok: false,
          error: "This application isn't waiting on a final decision any more. Refresh to see where it is.",
        };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't save the decision. Try again." };
  }
}
