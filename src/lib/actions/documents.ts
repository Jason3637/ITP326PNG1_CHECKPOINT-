"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import type { Document, DocumentType } from "@/lib/types";
import { ID_DOCUMENT_TYPES } from "@/lib/loan-wizard";

export type UploadResult = { ok: true; document: Document } | { ok: false; error: string };

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DOCUMENT_TYPE_VALUES = new Set<DocumentType>([
  "id_verification",
  "receipt",
  "loan_file",
  "proof_of_income",
]);

// Shared by the loan application wizard (ID + proof-of-income uploads) and
// the repayment-report flow (receipt uploads) — same backend endpoint
// either way. Takes a single FormData argument rather than a raw File —
// FormData is the one file-carrying shape Next's Server Actions docs
// universally show being passed to a Server Function; a bare File as a
// standalone argument (outside a <form>-submitted FormData) isn't
// documented, so this avoids relying on unconfirmed behavior.
//
// Mirrors the existing Supabase-backed upload the backend already exposes
// (POST /api/users/documents uploads to Supabase Storage server-side) — the
// frontend never talks to Supabase directly.
const ID_DOCUMENT_TYPE_VALUES = new Set<string>(ID_DOCUMENT_TYPES.map((t) => t.value));

export async function uploadLoanDocument(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file");
  const documentType = formData.get("document_type");
  const loanApplicationId = formData.get("loan_application_id");
  const idDocumentType = formData.get("id_document_type");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Select a file to upload." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "File is too large. Maximum size is 10 MB." };
  }
  if (!ACCEPTED_DOCUMENT_TYPES.has(file.type)) {
    return { ok: false, error: "Unsupported file type. Upload a PDF, JPG, or PNG." };
  }
  if (typeof documentType !== "string" || !DOCUMENT_TYPE_VALUES.has(documentType as DocumentType)) {
    return { ok: false, error: "Missing or invalid document type." };
  }

  const upload = new FormData();
  upload.set("file", file);
  upload.set("document_type", documentType);
  if (typeof loanApplicationId === "string" && loanApplicationId.trim()) {
    upload.set("loan_application_id", loanApplicationId);
  }
  // Which kind of ID (national ID, passport, ...) - ID documents only.
  if (typeof idDocumentType === "string" && idDocumentType) {
    if (documentType !== "id_verification" || !ID_DOCUMENT_TYPE_VALUES.has(idDocumentType)) {
      return { ok: false, error: "Select a valid ID type." };
    }
    upload.set("id_document_type", idDocumentType);
  }

  try {
    const document = await serverApiFetch<Document>("/users/documents", {
      method: "POST",
      body: upload,
    });
    return { ok: true, document };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't upload that file. Try again." };
  }
}
