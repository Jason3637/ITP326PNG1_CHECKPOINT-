"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import type { LoanApplication } from "@/lib/types";

export type RespondResult = { ok: true; application: LoanApplication } | { ok: false; error: string };

export interface RespondInput {
  applicationId: number;
  responseNote: string;
  documentIds: number[];
}

// POST /api/loans/applications/{id}/respond - updates the SAME application
// (never creates a new one) and returns it to OFFICER_REVIEW. Every field
// besides response_note is optional on the backend; this form only ever
// sends response_note plus any newly-uploaded documents, since that covers
// the common case ("here's the clearer ID photo you asked for") without
// forcing the customer to re-enter everything else on the application.
export async function respondToActionRequired(input: RespondInput): Promise<RespondResult> {
  if (!input.responseNote.trim()) {
    return { ok: false, error: "Describe what you changed or are providing." };
  }

  try {
    const application = await serverApiFetch<LoanApplication>(
      `/loans/applications/${input.applicationId}/respond`,
      {
        method: "POST",
        body: {
          response_note: input.responseNote,
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
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
