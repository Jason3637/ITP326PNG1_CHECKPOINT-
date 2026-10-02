"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { isRecommendationType, validateRecommendation } from "@/lib/recommendations";
import type { OfficerRecommendationType } from "@/lib/types";

export type RecommendResult = { ok: true; kind: OfficerRecommendationType } | { ok: false; error: string };

// POST /loans/applications/<id>/recommend - records the officer's
// recommendation (immutable, with the checklist frozen into it) and moves
// OFFICER_REVIEW -> RECOMMENDED_FOR_APPROVAL / RECOMMENDED_FOR_REJECTION.
// Per the backend, this creates no loan and no disbursement and decides
// nothing; the administrator does that. The backend also refuses an
// approval recommendation while any required check is outstanding (409).
export async function submitRecommendation(
  applicationId: number,
  kind: OfficerRecommendationType,
  comments: string,
): Promise<RecommendResult> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) return { ok: false, error: "Unknown application." };
  if (!isRecommendationType(kind)) return { ok: false, error: "Choose approval or rejection." };
  const invalid = validateRecommendation(kind, typeof comments === "string" ? comments : "");
  if (invalid) return { ok: false, error: invalid };

  try {
    await serverApiFetch(`/loans/applications/${applicationId}/recommend`, {
      method: "POST",
      body: { recommendation: kind, comments: comments.trim() },
    });
    return { ok: true, kind };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return { ok: false, error: "Only the assigned officer or an administrator can send a recommendation." };
      }
      if (err.status === 409) {
        return {
          ok: false,
          error:
            kind === "recommend_approval"
              ? "The checklist isn't complete enough to recommend approval, or the application has moved on. Refresh to see its current state."
              : "This application isn't under review any more. Refresh to see where it is.",
        };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't send the recommendation. Try again." };
  }
}
