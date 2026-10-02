"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import type { LoanApplication } from "@/lib/types";

export type RespondResult = { ok: true; application: LoanApplication } | { ok: false; error: string };

export interface RespondInput {
  applicationId: number;
  // One answer per open request - the backend requires every open request
  // to be answered in the same call, each linked to its own request.
  responses: { information_request_id: number; response_note: string }[];
  documentIds: number[];
}

// POST /api/loans/applications/{id}/respond - updates the SAME application
// (never creates a new one) and returns it to OFFICER_REVIEW, recording one
// InformationResponse per answered request. Earlier rounds' requests and
// responses are left as they were. Only answers and newly uploaded
// documents are sent; other application fields stay untouched.
export async function respondToActionRequired(input: RespondInput): Promise<RespondResult> {
  if (!Number.isInteger(input.applicationId) || input.applicationId <= 0) {
    return { ok: false, error: "Something went wrong. Try again." };
  }
  if (!Array.isArray(input.responses) || input.responses.length === 0) {
    return { ok: false, error: "There's nothing to respond to on this application." };
  }
  if (input.responses.some((r) => !Number.isInteger(r.information_request_id) || !r.response_note?.trim())) {
    return { ok: false, error: "Answer each request before sending." };
  }
  if (input.responses.some((r) => r.response_note.trim().length > 1000)) {
    return { ok: false, error: "Keep each answer under 1000 characters." };
  }

  try {
    const application = await serverApiFetch<LoanApplication>(
      `/loans/applications/${input.applicationId}/respond`,
      {
        method: "POST",
        body: {
          responses: input.responses.map((r) => ({
            information_request_id: r.information_request_id,
            response_note: r.response_note.trim(),
          })),
          document_ids: input.documentIds.length > 0 ? input.documentIds : undefined,
        },
      },
    );
    return { ok: true, application };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return { ok: false, error: "These requests have changed since you opened this page. Refresh and try again." };
      }
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
