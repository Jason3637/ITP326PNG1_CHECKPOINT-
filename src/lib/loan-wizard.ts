import type { DisbursementMethod, EmploymentStatus, LoanApplicationStatus, PurposeCategory } from "./types";

// The backend's real purpose_category enum (app/models/enums.py:
// LoanPurposeCategory) - previously this UI used its own invented category
// list and smuggled it into the free-text `purpose` field, because no real
// field existed. It exists now; use it directly.
export const PURPOSE_CATEGORIES: { value: PurposeCategory; label: string }[] = [
  { value: "business", label: "Business" },
  { value: "school_fees", label: "School Fees" },
  { value: "medical", label: "Medical" },
  { value: "home_improvement", label: "Home Improvement" },
  { value: "debt_consolidation", label: "Debt Consolidation" },
  { value: "other", label: "Other" },
];

export const EMPLOYMENT_STATUSES: { value: EmploymentStatus; label: string }[] = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "retired", label: "Retired" },
  { value: "student", label: "Student" },
];

// The backend's real disbursement_method_requested enum. Cash on Hand needs
// nothing extra; BSP Mobile Banking needs a receiving mobile number
// (disbursement_account_reference on the backend).
export const DISBURSEMENT_METHODS: { value: DisbursementMethod; label: string }[] = [
  { value: "bsp_mobile_banking", label: "BSP Mobile Banking" },
  { value: "cash_on_hand", label: "Cash on Hand" },
];

// Identifies which kind of ID was uploaded. Still not a real backend field
// (POST /api/users/documents has no ID sub-type) - the filename prefix
// remains the only place it can travel with the file.
export type IdDocumentType = "national_id" | "drivers_licence" | "passport" | "work_id";

export const ID_DOCUMENT_TYPES: { value: IdDocumentType; label: string }[] = [
  { value: "national_id", label: "National ID" },
  { value: "drivers_licence", label: "Driver's Licence" },
  { value: "passport", label: "Passport" },
  { value: "work_id", label: "Work ID" },
];

// Matches the backend's named rule exactly (app/services/documents.py:
// PROOF_OF_INCOME_REQUIRED_ABOVE). Kept as its own constant here (rather
// than fetched from the backend) so the wizard can react to the typed
// amount instantly - if the backend threshold ever changes, update both.
export const PROOF_OF_INCOME_THRESHOLD = 1000;

// PRIME's fixed term - shown as read-only info, never collected as input
// (the old term_months/repayment_frequency fields don't exist on the
// backend anymore).
export const PRIME_TERM_DAYS = 14;

// Must match the backend's CURRENT_POLICY_VERSION exactly (app/config.py) -
// the backend rejects a mismatched policy_version as "out of date". There is
// no endpoint to read the current version, so it's duplicated here; keep
// both in sync when the policy document changes.
export const TERMS_VERSION = "2026-09-v1";

export interface RefereeDetails {
  fullName: string;
  relationship: string;
  mobile: string;
  employer: string;
}

// Every backend application status, mapped to the SAME customer-facing
// copy the backend's own `status_label` field already provides (see
// app/services/loan_processing.py:status_label()). This local copy exists
// only as a fallback for the couple of places that don't have a live
// LoanApplication to read status_label from (e.g. a cached snapshot) -
// prefer `application.status_label` from the API wherever one is available.
const STATUS_LABELS: Record<LoanApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  officer_review: "Under Review",
  customer_action_required: "Action Required",
  recommended_for_approval: "Under Review",
  admin_review: "Under Review",
  approved: "Approved",
  rejected: "Not Approved",
  awaiting_disbursement: "Approved - Processing Disbursement",
};

export function humanApplicationStatus(status: string): string {
  return STATUS_LABELS[status as LoanApplicationStatus] ?? "Under Review";
}

export function isTerminalRejected(status: string): boolean {
  return status === "rejected";
}

export function isActionRequired(status: string): boolean {
  return status === "customer_action_required";
}

// Any status that means "still going" - used to decide whether "Apply for
// a Loan" should be offered (the backend allows only one open application
// at a time).
export function isOpenApplication(status: string): boolean {
  return !["approved", "rejected", "awaiting_disbursement"].includes(status);
}
