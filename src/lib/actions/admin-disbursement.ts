"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { isDisbursementMethod, validateDisbursement, type DisbursementInput } from "@/lib/disbursement";
import type { AdminLoanDetail, LoanStatus } from "@/lib/types";

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EVIDENCE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export type EvidenceResult = { ok: true; documentId: number } | { ok: false; error: string };
export type DisburseResult = { ok: true; loanId: number; loanStatus: LoanStatus } | { ok: false; error: string };

const SESSION_EXPIRED = "Your session expired. Refresh the page and log in again.";
const NOT_AWAITING =
  "This application isn't awaiting disbursement any more - it may already have been recorded. Refresh to see where it is.";

// POST /admin/applications/<id>/disbursement-evidence (multipart `file`).
// The backend stores it in Supabase Storage as a disbursement_evidence
// document under the customer - the same Supabase-backed path as every
// other upload; the browser never talks to Supabase. FormData in, as with
// uploadLoanDocument.
export async function uploadDisbursementEvidence(formData: FormData): Promise<EvidenceResult> {
  const applicationId = Number(formData.get("application_id"));
  const file = formData.get("file");
  if (!Number.isInteger(applicationId) || applicationId <= 0) return { ok: false, error: "Unknown application." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Select a file to upload." };
  if (file.size > MAX_EVIDENCE_BYTES) return { ok: false, error: "File is too large. Maximum size is 10 MB." };
  if (!ACCEPTED_EVIDENCE_TYPES.has(file.type)) {
    return { ok: false, error: "Unsupported file type. Upload a PDF, JPG, or PNG." };
  }

  const upload = new FormData();
  upload.set("file", file);
  try {
    const doc = await serverApiFetch<{ id: number }>(`/admin/applications/${applicationId}/disbursement-evidence`, {
      method: "POST",
      body: upload,
    });
    return { ok: true, documentId: doc.id };
  } catch (err) {
    if (err instanceof UnauthenticatedError) return { ok: false, error: SESSION_EXPIRED };
    if (err instanceof ApiError) {
      if (err.status === 409) return { ok: false, error: NOT_AWAITING };
      if (err.status === 403) return { ok: false, error: "Only an administrator can record a disbursement." };
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't upload the evidence. Try again." };
  }
}

// The backend's 400 messages name its fields (method_reference,
// disbursed_at, evidence_document_id) - reworded for the admin here.
function disbursementError(err: ApiError): string {
  const m = err.message;
  if (/disbursed_at can't be in the future/.test(m)) return "The payout time can't be in the future.";
  if (/disbursed_at can't be before/.test(m)) return "The payout time can't be before the application was approved.";
  if (/disbursed_at/.test(m)) return "Enter the date and time the money moved.";
  if (/method_reference/.test(m)) return "Enter the transaction or acknowledgement number (up to 255 characters).";
  if (/already attached/.test(m)) return "That evidence file is already attached to another disbursement. Upload it again.";
  if (/evidence_document_id/.test(m)) return "That evidence file can't be used for this application. Upload it again.";
  return customerSafeMessage(err);
}

// POST /admin/applications/<id>/disbursement. One backend transaction:
// Disbursement record, loan terms snapshot, original-obligation ledger
// entry, loan ACTIVE, application DISBURSED. A second disbursement of the
// same application is refused by the database (409) - this is the real
// double-submit guard; the form's disabled button is the UI one.
export async function recordDisbursement(
  applicationId: number,
  input: DisbursementInput,
  evidenceDocumentId: number | null,
): Promise<DisburseResult> {
  if (!Number.isInteger(applicationId) || applicationId <= 0) return { ok: false, error: "Unknown application." };
  if (!input || !isDisbursementMethod(input.method)) return { ok: false, error: "Choose how the money was paid out." };
  const clean: DisbursementInput = {
    method: input.method,
    reference: typeof input.reference === "string" ? input.reference.trim() : "",
    disbursedAt: typeof input.disbursedAt === "string" ? input.disbursedAt : "",
    note: typeof input.note === "string" ? input.note.trim() : "",
  };
  const invalid = validateDisbursement(clean);
  if (invalid) return { ok: false, error: invalid };

  const body: Record<string, unknown> = { method: clean.method, reference: clean.reference };
  // A datetime-local value has no offset; the backend reads that as
  // Port Moresby wall-clock time, which is what the label says.
  if (clean.disbursedAt) body.disbursed_at = clean.disbursedAt;
  if (clean.note) body.note = clean.note;
  if (evidenceDocumentId !== null && Number.isInteger(evidenceDocumentId)) body.evidence_document_id = evidenceDocumentId;

  try {
    const loan = await serverApiFetch<AdminLoanDetail>(`/admin/applications/${applicationId}/disbursement`, {
      method: "POST",
      body,
    });
    return { ok: true, loanId: loan.loan_id, loanStatus: loan.status };
  } catch (err) {
    if (err instanceof UnauthenticatedError) return { ok: false, error: SESSION_EXPIRED };
    if (err instanceof ApiError) {
      if (err.status === 409) return { ok: false, error: NOT_AWAITING };
      if (err.status === 403) return { ok: false, error: "Only an administrator can record a disbursement." };
      if (err.status === 400) return { ok: false, error: disbursementError(err) };
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't record the disbursement. Try again." };
  }
}
