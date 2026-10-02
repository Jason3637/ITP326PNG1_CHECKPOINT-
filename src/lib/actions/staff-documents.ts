"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";

export type DocumentUrlResult = { ok: true; url: string } | { ok: false; error: string };

// GET /users/documents/<id>/download - a short-lived Supabase signed URL.
// The backend decides access (owner or staff) and writes a
// document_download audit row with by_staff=true for every call, so each
// time an officer opens a customer's file is on record. Fetched only on
// click, never at page render: a signed URL baked into the page would
// expire while the officer is still reading, and would log a "download"
// for every page view.
export async function getStaffDocumentUrl(documentId: number): Promise<DocumentUrlResult> {
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return { ok: false, error: "Unknown document." };
  }
  try {
    const { signed_url } = await serverApiFetch<{ signed_url: string }>(`/users/documents/${documentId}/download`);
    if (typeof signed_url !== "string" || !/^https?:\/\//.test(signed_url)) {
      return { ok: false, error: "Couldn't open this document. Try again." };
    }
    return { ok: true, url: signed_url };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't open this document. Try again." };
  }
}
