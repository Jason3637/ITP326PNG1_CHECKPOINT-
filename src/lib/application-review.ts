import { DISBURSEMENT_METHODS, EMPLOYMENT_STATUSES } from "./loan-wizard";
import type { CreditAdvisory, DocumentType, ReviewDocument } from "./types";

// Prime's Vault is a PNG cooperative; staff read times in PNG time
// regardless of where the server rendering the page happens to run.
const TIME_ZONE = "Pacific/Port_Moresby";

// Backend timestamps are timezone-aware UTC columns, so they normally carry
// an offset. One without (seen from the SQLite test config) would be read
// by JS as server-local time - treat it as UTC, which is what was stored.
export function parseBackendTimestamp(iso: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  return new Date(hasZone || !iso.includes("T") ? iso : `${iso}Z`);
}

export function formatReviewDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = parseBackendTimestamp(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TIME_ZONE });
}

export function formatReviewDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = parseBackendTimestamp(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    timeZoneName: "short",
  });
}

// Plain calendar-date DOB ("1990-05-01") from the customer's verification.
// Age is a display convenience derived from the backend's own DOB - not a
// financial figure, so deriving it here doesn't conflict with "never
// recalculate pricing client-side".
export function ageFromDob(dob: string | null, now: Date = new Date()): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export function formatDob(dob: string): string {
  // Parsed as a UTC calendar date and formatted in UTC so it never shifts a
  // day because of the server's timezone.
  const d = new Date(`${dob}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? dob
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  id_verification: "ID document",
  proof_of_income: "Proof of income",
  loan_file: "Loan file",
  receipt: "Repayment receipt",
  disbursement_evidence: "Disbursement evidence",
};

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type as DocumentType] ?? "Document";
}

export function disbursementLabel(method: string | null): string | null {
  if (!method) return null;
  return DISBURSEMENT_METHODS.find((m) => m.value === method)?.label ?? null;
}

export function employmentLabel(status: string | null): string | null {
  if (!status) return null;
  return EMPLOYMENT_STATUSES.find((s) => s.value === status)?.label ?? null;
}

// What each of the credit model's criteria actually looked at - from the
// backend's own description (app/services/credit_evaluation.py module
// docstring), so the officer can see what produced each note.
export const CREDIT_CRITERIA: Record<string, { label: string; input: string }> = {
  requested_amount_vs_limits: {
    label: "Requested amount",
    input: "The amount on this application, compared with the allowed loan range.",
  },
  repayment_history: {
    label: "Repayment history",
    input: "How on time the member's past installments were paid.",
  },
  prior_loan_status: {
    label: "Previous loans",
    input: "Whether the member has a defaulted loan or a loan still active.",
  },
  account_standing: {
    label: "Account standing",
    input: "Whether the member's account is active.",
  },
  minimum_income: {
    label: "Monthly income",
    input: "Self-reported monthly income on this application (not verified).",
  },
  employment_status: {
    label: "Employment status",
    input: "Self-reported employment status on this application (not verified).",
  },
  debt_to_income_ratio: {
    label: "Debt-to-income",
    input: "Self-reported existing monthly debt plus the new repayment, against monthly income.",
  },
  membership_tenure: {
    label: "Membership length",
    input: "How long the member has had an account.",
  },
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// Copies ONLY the explanatory fields out of the backend's
// credit_evaluation_result - a runtime whitelist, not just a type, so the
// score / eligible / "review"|"decline" recommendation / max eligible
// amount never reach the rendered page, even by accident. The model name
// and stored disclaimer are dropped too (see CreditAdvisory in types.ts).
export function toCreditAdvisory(raw: unknown): CreditAdvisory | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    evaluated_at: typeof r.evaluated_at === "string" ? r.evaluated_at : "",
    insufficient_data: r.insufficient_data === true,
    reasons: asStringArray(r.reasons),
    criteria_checked: asStringArray(r.criteria_checked),
  };
}

// Earlier (superseded) versions relevant to this application - those
// linked to it, plus ID documents (ID is customer-level, not per
// application). Receipts or files for the customer's other loans are left
// out: the review screen is about this application only.
export function relevantEarlierVersions(applicationId: number, all: ReviewDocument[]): ReviewDocument[] {
  return all.filter(
    (d) => !d.is_current && (d.loan_application_id === applicationId || d.document_type === "id_verification"),
  );
}
