import { documentTypeLabel } from "./application-review";
import { DISBURSEMENT_METHODS, EMPLOYMENT_STATUSES, PURPOSE_CATEGORIES } from "./loan-wizard";
import { formatKina } from "./utils";
import type { DocumentType, InformationRequestType } from "./types";

// The backend's InformationRequestType values. Labels are worded so the
// same text works for the officer choosing it and the customer reading it.
export const REQUEST_TYPES: { value: InformationRequestType; label: string }[] = [
  { value: "missing_document", label: "Missing document" },
  { value: "document_unclear", label: "Document is unclear" },
  { value: "document_expired", label: "Document has expired" },
  { value: "information_mismatch", label: "Details don't match" },
  { value: "referee_unreachable", label: "Referee couldn't be reached" },
  { value: "employment_confirmation", label: "Employment confirmation needed" },
  { value: "other", label: "Other" },
];

export function requestTypeLabel(type: string): string {
  return REQUEST_TYPES.find((t) => t.value === type)?.label ?? "Information needed";
}

// Documents a customer can be asked to upload. Receipts belong to the
// repayment flow, not to an application review.
export const REQUESTABLE_DOCUMENT_TYPES: DocumentType[] = ["id_verification", "proof_of_income", "loan_file"];

// "Upload your ___" - lowercase where natural, but never "id document".
const DOCUMENT_NOUNS: Record<string, string> = {
  id_verification: "ID document",
  proof_of_income: "proof of income",
  loan_file: "loan file",
  receipt: "receipt",
};

export function documentNoun(type: string): string {
  return DOCUMENT_NOUNS[type] ?? "document";
}

export function isRequestType(value: unknown): value is InformationRequestType {
  return typeof value === "string" && REQUEST_TYPES.some((t) => t.value === value);
}

// Dispatched on window to ask the officer's request-more-information panel
// to open (from the verification checklist's header).
export const REQUEST_INFORMATION_OPEN_EVENT = "officer:open-request-information";

// The backend's per-item limits (loan_processing._parse_information_requests).
export const REQUEST_LIMITS = { reason: 1000, required_information: 500, internal_note: 1000, perRound: 10 } as const;

export interface RequestDraft {
  request_type: InformationRequestType | "";
  reason: string;
  required_document_type: DocumentType | "";
  required_information: string;
  internal_note: string;
}

export const EMPTY_REQUEST_DRAFT: RequestDraft = {
  request_type: "",
  reason: "",
  required_document_type: "",
  required_information: "",
  internal_note: "",
};

export type RequestDraftErrors = Partial<Record<keyof RequestDraft, string>>;

export function validateRequestDraft(d: RequestDraft): RequestDraftErrors {
  const errors: RequestDraftErrors = {};
  if (!d.request_type || !isRequestType(d.request_type)) errors.request_type = "Choose what kind of request this is.";
  if (!d.reason.trim()) errors.reason = "Tell the customer what's needed and why.";
  else if (d.reason.trim().length > REQUEST_LIMITS.reason) errors.reason = `Keep this under ${REQUEST_LIMITS.reason} characters.`;
  if (d.required_document_type && !REQUESTABLE_DOCUMENT_TYPES.includes(d.required_document_type)) {
    errors.required_document_type = "Choose a document type from the list.";
  }
  if (d.required_information.trim().length > REQUEST_LIMITS.required_information) {
    errors.required_information = `Keep this under ${REQUEST_LIMITS.required_information} characters.`;
  }
  if (d.internal_note.trim().length > REQUEST_LIMITS.internal_note) {
    errors.internal_note = `Keep this under ${REQUEST_LIMITS.internal_note} characters.`;
  }
  return errors;
}

// What a request asks the customer for, as short lines ("Upload: Proof of
// income", "Provide: Employer's name and phone").
export function requiredItems(r: { required_document_type: string | null; required_information: string | null }): string[] {
  const items: string[] = [];
  if (r.required_document_type) items.push(`Upload: ${documentTypeLabel(r.required_document_type)}`);
  if (r.required_information) items.push(`Provide: ${r.required_information}`);
  return items;
}

const FIELD_LABELS: Record<string, string> = {
  purpose_category: "Purpose",
  purpose: "Purpose description",
  confirmed_full_name: "Name",
  confirmed_email: "Email",
  confirmed_phone_number: "Mobile",
  monthly_income: "Monthly income",
  employment_status: "Employment status",
  existing_monthly_debt: "Existing monthly debt",
  referees: "Referees",
  disbursement_method_requested: "Disbursement method",
  disbursement_account_reference: "Disbursement account",
};

const MONEY_FIELDS = new Set(["monthly_income", "existing_monthly_debt"]);

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "(blank)";
  if (MONEY_FIELDS.has(field) && typeof value === "number") return formatKina(value);
  if (field === "employment_status") return EMPLOYMENT_STATUSES.find((s) => s.value === value)?.label ?? String(value);
  if (field === "purpose_category") return PURPOSE_CATEGORIES.find((c) => c.value === value)?.label ?? String(value);
  if (field === "disbursement_method_requested") {
    return DISBURSEMENT_METHODS.find((m) => m.value === value)?.label ?? String(value);
  }
  if (field === "referees" && Array.isArray(value)) {
    return value
      .map((r) => (r && typeof r === "object" && "full_name" in r ? String((r as { full_name: unknown }).full_name) : "?"))
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// The backend's field_changes ({field: {old, new}}) as readable lines.
export function describeFieldChanges(
  changes: Record<string, { old: unknown; new: unknown }> | null | undefined,
): { label: string; from: string; to: string }[] {
  if (!changes) return [];
  return Object.entries(changes).map(([field, c]) => ({
    label: FIELD_LABELS[field] ?? "Other detail",
    from: formatFieldValue(field, c?.old),
    to: formatFieldValue(field, c?.new),
  }));
}

export interface RequestRound<T extends { requested_at: string | null }> {
  requestedAt: string | null;
  requests: T[];
}

// Groups requests into the rounds they were sent in. A round is one
// request-action call: its rows are inserted in one transaction, so they
// share requested_at exactly. Oldest round first, matching the backend's
// order.
export function groupIntoRounds<T extends { id: number; requested_at: string | null }>(requests: T[]): RequestRound<T>[] {
  const rounds: RequestRound<T>[] = [];
  const sorted = [...requests].sort((a, b) => {
    const ta = a.requested_at ?? "";
    const tb = b.requested_at ?? "";
    return ta === tb ? a.id - b.id : ta < tb ? -1 : 1;
  });
  for (const r of sorted) {
    const last = rounds[rounds.length - 1];
    if (last && last.requestedAt === r.requested_at) last.requests.push(r);
    else rounds.push({ requestedAt: r.requested_at, requests: [r] });
  }
  return rounds;
}
