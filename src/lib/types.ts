import type { IdDocumentType } from "./loan-wizard";

// Types mirror the live PRIME-workflow backend (GET /api/swagger.json).
// Updated to match the Phase 1-9 backend rewrite - the previous version of
// this file was built against the pre-rewrite production deployment and
// had drifted significantly (see the integration-pass report that replaced
// it). Auth types are unchanged - the auth flow was never touched by that
// rewrite.

export interface ApiErrorBody {
  message: string;
}

// ---- Auth ---------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  phone_number?: string;
}

export interface RegisterResponse {
  message: string;
  user_id: number;
  next_step: string;
  mfa_setup_token: string;
}

export interface MfaSetupResponse {
  message: string;
  totp_secret: string;
  provisioning_uri: string;
  qr_code_png: string; // data:image/png;base64,...
  next_step: string;
}

export interface MfaVerifySetupInput {
  code: string;
}

export interface MfaVerifySetupResponse {
  message: string;
  backup_codes: string[];
  next_step: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  mfa_required: "challenge" | "setup";
  mfa_challenge_token?: string;
  mfa_setup_token?: string;
  next_step: string;
}

export interface MfaVerifyLoginInput {
  code?: string;
  backup_code?: string;
}

export interface TokenResponse {
  message: string;
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  role: Role;
}

export type Role = "customer" | "loan_officer" | "admin";

export interface MeResponse {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  totp_enabled: boolean;
}

export interface Profile {
  id: number;
  email: string;
  full_name: string;
  phone_number: string | null;
  role: Role;
  is_active: boolean;
  totp_enabled: boolean;
  created_at: string;
}

// ---- Accounts / Dashboard -------------------------------------------------

export interface AccountSummary {
  user_id: number;
  counts: { active: number; overdue: number; paid: number; closed: number; defaulted: number; total: number };
  active_loans: ActiveLoanSummary[];
  next_repayment_due: NextRepaymentDue | null;
  has_overdue: boolean;
}

export interface ActiveLoanSummary {
  loan_id: number;
  status: LoanStatus;
  principal_amount: number;
  interest_rate: number;
  total_repayable: number;
  installment_amount: number;
  installments_total: number;
  installments_paid: number;
  installments_overdue: number;
  amount_paid: number;
  amount_remaining: number;
  progress_percent: number;
  disbursed_at: string | null;
  next_repayment: NextRepaymentDue | null;
}

export interface NextRepaymentDue {
  loan_id?: number;
  installment_number?: number;
  due_date?: string;
  amount_due?: number;
  amount_paid?: number;
  status?: string;
  days_until_due?: number;
  [key: string]: unknown;
}

export interface DashboardKpis {
  active_loans: number;
  total_loans: number;
  total_borrowed: number;
  outstanding_balance: number;
  amount_repaid: number;
  overdue_installments: number;
  overdue_amount: number;
  next_payment: NextRepaymentDue | null;
}

export interface ChartBlock {
  labels: string[];
  series: { name: string; data: number[] }[];
}

export interface Dashboard {
  role: Role;
  generated_at: string;
  currency: string;
  kpis: DashboardKpis;
  charts: Record<string, ChartBlock>;
  tables: { loans: unknown[]; [key: string]: unknown[] };
}

// ---- Loans ----------------------------------------------------------------

// The full two-tier officer -> admin review chain. Never render these raw
// to a customer - use `status_label` (below), which the backend already
// computes for exactly this purpose.
export type InformationRequestType =
  | "missing_document"
  | "document_unclear"
  | "document_expired"
  | "information_mismatch"
  | "referee_unreachable"
  | "employment_confirmation"
  | "other";

export type InformationRequestStatus = "open" | "responded" | "cancelled";

// Customer view of a request (app/services/loan_processing.py
// serialize_information_request(staff=False)) - no internal note, no staff
// identities.
export interface CustomerInformationRequest {
  id: number;
  request_type: InformationRequestType;
  reason: string;
  required_document_type: DocumentType | null;
  required_information: string | null;
  status: InformationRequestStatus;
  requested_at: string | null;
  cancelled_at: string | null;
  response: { response_note: string; responded_at: string | null; provided_document_ids: number[] | null } | null;
}

export type LoanApplicationStatus =
  | "draft"
  | "submitted"
  | "officer_review"
  | "customer_action_required"
  | "recommended_for_approval"
  | "recommended_for_rejection"
  | "admin_review"
  | "approved"
  | "rejected"
  | "awaiting_disbursement"
  | "returned_to_officer";

export type LoanStatus = "active" | "overdue" | "paid" | "closed";
export type LoanClosureReason = "paid_in_full" | "defaulted";
export type InstallmentStatus = "upcoming" | "paid" | "overdue" | string;
export type EmploymentStatus = "employed" | "self_employed" | "unemployed" | "retired" | "student";
export type DisbursementMethod = "bsp_mobile_banking" | "cash_on_hand";
export type PurposeCategory =
  | "business"
  | "school_fees"
  | "medical"
  | "home_improvement"
  | "debt_consolidation"
  | "other";

export interface CreditEvaluationResult {
  score: number;
  reasons: string[];
  eligible: boolean;
  algorithm: string;
  disclaimer: string;
  evaluated_at: string;
  recommendation: string;
  requested_amount: number;
  max_eligible_amount: number;
  insufficient_data: boolean;
  criteria_checked: string[];
}

export interface RefereeInput {
  full_name: string;
  relationship: string;
  mobile_number: string;
  employer_name?: string;
}

export interface Referee extends RefereeInput {
  id: number;
}

// POST /api/loans/apply - the full PRIME application payload. term_months /
// repayment_frequency do NOT exist here - PRIME fixes the term at 14 days.
export interface LoanApplyInput {
  amount_requested: number;
  purpose_category: PurposeCategory;
  purpose?: string; // required by the backend when purpose_category is "other"
  confirmed_full_name: string;
  confirmed_email: string;
  confirmed_phone_number?: string;
  monthly_income?: number;
  employment_status?: EmploymentStatus;
  existing_monthly_debt?: number;
  residential_address: string; // required
  employer_name?: string; // required when employment_status is employed or self_employed
  referees: RefereeInput[]; // at least one required
  disbursement_method_requested: DisbursementMethod;
  disbursement_account_reference?: string; // required when method is bsp_mobile_banking
  accept_terms: boolean;
  policy_version: string;
  document_ids?: number[]; // must include a current proof_of_income doc when amount >= K1,000
}

export interface PrimePricing {
  category: string; // "PRIME 1" | "PRIME 2" | "PRIME 3"
  amount: number;
  interest_amount: number;
  // The tier's flat rate for the whole term (0.40 = 40% over term_days), not
  // an annual rate. From the backend's prime_pricing - never derived here.
  interest_rate: number;
  total_repayable: number;
  term_days: number;
}

export interface LoanApplication {
  id: number;
  user_id: number;
  amount_requested: number;
  purpose_category: PurposeCategory | null;
  purpose: string | null;
  confirmed_full_name: string | null;
  confirmed_email: string | null;
  confirmed_phone_number: string | null;
  prime_category: string | null;
  pricing: PrimePricing | null;
  monthly_income: number | null;
  employment_status: EmploymentStatus | null;
  existing_monthly_debt: number | null;
  residential_address: string | null; // null only on applications made before it was collected
  employer_name: string | null; // null when not employed / self-employed, or on older applications
  disbursement_method_requested: DisbursementMethod | null;
  disbursement_account_reference: string | null;
  referees: Referee[];
  policy_version_accepted: string | null;
  status: LoanApplicationStatus;
  status_label: string; // customer-facing label - always use this, never `status`, in UI copy
  action_required_note: string | null; // set while status is customer_action_required
  information_requests: CustomerInformationRequest[]; // every round, oldest first
  credit_evaluation_result: CreditEvaluationResult | null;
  submitted_at: string;
  decided_at: string | null;
  decided_by: number | null;
  loan_id: number | null;
}

export interface LoanApplicationList {
  count: number;
  applications: LoanApplication[];
}

export interface RepaymentScheduleItem {
  id: number; // the row id - this is what repayment_schedule_id means to POST /payments/repay
  installment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: InstallmentStatus;
}

export interface Disbursement {
  method: DisbursementMethod;
  method_reference: string | null;
  amount: number;
  disbursed_at: string;
  recorded_by: number | null;
}

export interface Loan {
  id: number;
  application_id: number;
  user_id: number;
  principal_amount: number;
  interest_rate: number;
  term_days: number; // NOT term_months - PRIME's fixed 14-day term
  installment_amount: number;
  total_repayable: number;
  status: LoanStatus;
  closure_reason: LoanClosureReason | null;
  disbursed_at: string | null;
  disbursement: Disbursement | null;
  repayment_schedule: RepaymentScheduleItem[];
}

export interface MyLoans {
  count: number;
  loans: Loan[];
}

// ---- Payments ---------------------------------------------------------------

export type PaymentStatus = "reported" | "verification_pending" | "verified" | "rejected";

export interface PaymentReceipt {
  id: number;
  document_type: string;
  storage_path: string;
  uploaded_at: string;
  is_current: boolean;
}

export interface PaymentTransaction {
  id: number;
  loan_id: number;
  repayment_schedule_id: number;
  amount: number;
  payment_method: string;
  payment_date: string | null; // date the customer says they paid
  reference_number: string | null;
  status: PaymentStatus;
  rejection_reason: string | null; // set only when status is rejected
  reported_at: string | null; // when it was reported
  paid_at: string | null; // set ONLY once VERIFIED - null until then
  receipts?: PaymentReceipt[];
}

export interface ReportPaymentInput {
  repayment_schedule_id: number;
  amount: number;
  payment_method: string;
  payment_date?: string; // ISO date; defaults to today if omitted
  reference_number?: string;
  document_ids?: number[]; // receipt/screenshot uploads
}

export interface LoanPaymentList {
  loan_id: number;
  count: number;
  payments: PaymentTransaction[];
}

// ---- Documents --------------------------------------------------------------

export type DocumentType = "id_verification" | "receipt" | "loan_file" | "proof_of_income";

export interface Document {
  id: number;
  user_id: number;
  loan_application_id: number | null;
  payment_transaction_id: number | null;
  document_type: DocumentType;
  id_document_type: IdDocumentType | null; // id_verification documents only
  storage_path: string;
  uploaded_at: string;
  is_current: boolean;
  superseded_by_id: number | null;
}

export interface DocumentList {
  count: number;
  documents: Document[];
}

// ---- Staff: Loan Officer queues --------------------------------------------
// GET /officer/queues and /officer/queues/<queue> (loan_officer or admin).
// Queues are team-wide: every officer sees every application in a queue,
// with is_mine / assigned_officer_* saying whose it is. Narrow with
// ?assigned=me|unassigned rather than filtering client-side.

export type OfficerQueue =
  | "awaiting_review"
  | "under_review"
  | "customer_action_required"
  | "sent_to_admin"
  | "returned_by_admin";

export type QueueAssignmentFilter = "any" | "me" | "unassigned";

export interface QueueCount {
  total: number;
  mine: number;
  unassigned: number;
}

export interface QueueCounts {
  queues: Record<OfficerQueue, QueueCount>;
  definitions: Record<OfficerQueue, LoanApplicationStatus[]>;
}

export type OfficerRecommendationType = "recommend_approval" | "recommend_rejection";

export interface QueueItem {
  id: number;
  status: LoanApplicationStatus;
  customer_id: number;
  customer_name: string | null;
  amount_requested: number;
  prime_category: string | null;
  total_repayable: number;
  purpose_category: PurposeCategory | null;
  submitted_at: string | null;
  assigned_officer_id: number | null;
  assigned_officer_name: string | null;
  assigned_at: string | null;
  is_mine: boolean;
  open_information_requests: number;
  latest_recommendation: OfficerRecommendationType | null;
  returned_reason: string | null; // only set in the returned_by_admin queue
}

export interface QueuePage {
  queue: OfficerQueue;
  statuses: LoanApplicationStatus[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
  items: QueueItem[]; // oldest submission first
}

// ---- Staff: Application Review --------------------------------------------
// GET /officer/applications/<id>. The backend returns a raw dict (its
// Swagger model is documentation, not a filter), and that dict carries more
// than this screen should show - storage_path, internal user ids
// (user_id, decided_by, verified_by), the credit model's score/eligible/
// recommendation, recommendation snapshots. These types are DELIBERATELY
// partial: they declare only what the review screen renders, so a field
// can't be displayed by accident without someone adding it here first.
// The page also never hands this object to a client component whole - see
// staff/applications/[applicationId]/page.tsx.

export interface ReviewCustomerVerification {
  verified_by_name?: string | null;
  id_expiry_date?: string | null;
  verified_at: string | null;
  valid_until: string;
  date_of_birth: string;
  id_document_id: number | null;
}

export interface ReviewCustomer {
  id: number;
  full_name: string;
  email: string;
  phone_number: string | null;
  member_since: string | null;
  is_active: boolean;
  // Read off the ID by an officer at the Age 18+ check; shown whether or not
  // a verification is current.
  date_of_birth: string | null;
  // The customer's current verification - the only source of "Verified customer".
  verification: ReviewCustomerVerification | null;
}

export interface ReviewDocument {
  id: number;
  loan_application_id: number | null;
  document_type: DocumentType;
  id_document_type: IdDocumentType | null; // id_verification documents only
  uploaded_at: string | null;
  is_current: boolean;
  superseded_by_id: number | null;
  linked_to_this_application: boolean;
}

export interface ReviewApplication {
  id: number;
  amount_requested: number;
  purpose_category: PurposeCategory | null;
  purpose: string | null;
  confirmed_full_name: string | null;
  confirmed_email: string | null;
  confirmed_phone_number: string | null;
  prime_category: string | null;
  pricing: PrimePricing | null;
  monthly_income: number | null;
  employment_status: EmploymentStatus | null;
  existing_monthly_debt: number | null;
  residential_address: string | null;
  employer_name: string | null;
  disbursement_method_requested: DisbursementMethod | null;
  disbursement_account_reference: string | null;
  referees: Referee[];
  status: LoanApplicationStatus;
  submitted_at: string | null;
}

// Only the explanatory parts of credit_evaluation_result. score, eligible,
// recommendation ("review"/"decline") and max_eligible_amount are left out
// on purpose: on a review screen they read as an instruction, and the
// backend itself says this model is advisory, never a decision input.
export interface CreditAdvisory {
  algorithm: string;
  disclaimer: string;
  evaluated_at: string;
  insufficient_data: boolean;
  reasons: string[];
  criteria_checked: string[];
}

export interface ReviewCreditAssessment {
  label: string;
  advisory: boolean;
  affects_status: boolean;
  result: CreditAdvisory | null;
}

export type ChecklistItemStatus = "pending" | "verified" | "failed" | "not_applicable";

// Read-only here (status per check, shown beside the documents it
// concerns); editing the checklist is a separate screen.
// What a VERIFIED identity check recorded (backend VerificationItem.evidence):
// age_18_plus -> date_of_birth; valid_id -> which ID document + its expiry.
export interface ChecklistEvidence {
  date_of_birth?: string;
  id_document_id?: number;
  id_document_type?: string | null;
  id_expiry_date?: string | null;
}

export interface ReviewChecklistItem {
  item_type: string;
  label: string;
  required: boolean;
  status: ChecklistItemStatus;
  note: string | null;
  checked_by_name: string | null;
  checked_at: string | null;
  // Set when a customer verification backs this check (made from it, or
  // carried over from an earlier application).
  customer_verification_id: number | null;
  evidence: ChecklistEvidence | null;
}

export interface ReviewChecklistSummary {
  required: number;
  required_complete: number;
  failed: number;
  blocking_items: string[];
  ready_for_approval_recommendation: boolean;
}

export interface ReviewChecklist {
  started: boolean;
  items: ReviewChecklistItem[];
  summary: ReviewChecklistSummary;
}

export interface ReviewInformationResponse {
  response_note: string;
  responded_at: string | null;
  // {field: {old, new}} for every application field the customer changed
  // in this response - the evidence of what the application said before.
  field_changes: Record<string, { old: unknown; new: unknown }> | null;
  provided_document_ids: number[] | null;
}

// Staff view of one Request More Information item. internal_note is
// staff-only (the customer serialization omits it); requester/canceller
// user ids are left out - only names are shown.
export interface ReviewInformationRequest {
  id: number;
  request_type: InformationRequestType;
  reason: string;
  required_document_type: DocumentType | null;
  required_information: string | null;
  internal_note: string | null;
  status: InformationRequestStatus;
  requested_at: string | null;
  requested_by_name: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  response: ReviewInformationResponse | null;
}

// An officer's recommendation as recorded (immutable on the backend), with
// the checklist exactly as it stood when it was made. The backend also
// freezes the credit result into credit_evaluation_snapshot - deliberately
// not declared here, so it can't be rendered (it carries the score).
export interface ReviewRecommendation {
  id: number;
  officer_name: string | null;
  recommendation: OfficerRecommendationType;
  comments: string;
  checklist_snapshot: { item_type: string; label: string; required: boolean; status: ChecklistItemStatus; note: string | null }[] | null;
  created_at: string | null;
}

export interface ReviewAdminReturn {
  id: number;
  recommendation_id: number | null;
  returned_by_name: string | null;
  reason: string;
  created_at: string | null;
}

export interface ApplicationReview {
  application: ReviewApplication;
  customer: ReviewCustomer;
  documents: ReviewDocument[];
  checklist: ReviewChecklist;
  information_requests: ReviewInformationRequest[];
  recommendations: ReviewRecommendation[];
  admin_returns: ReviewAdminReturn[];
  // Used to decide what the screen offers (e.g. "update_checklist") - the
  // backend's own rules for this viewer, never re-derived here. Not shown.
  allowed_actions: string[];
  assignment: { officer_id: number | null; officer_name: string | null; assigned_at: string | null; is_mine: boolean };
  credit_assessment: ReviewCreditAssessment;
}

// ---- Staff: Customer History -----------------------------------------------
// GET /officer/applications/<id>/customer-history. Reached only through an
// application - there is no customer-id lookup anywhere in the API. Loan
// officers get 403 once the application is decided; admins always can.
// Every figure is computed by the backend.

export interface CustomerHistorySummary {
  previous_applications: number;
  previous_applications_rejected: number;
  loans_total: number;
  loans_active: number;
  loans_overdue: number;
  loans_completed: number;
  loans_defaulted: number;
  total_borrowed: number;
  total_repayable: number;
  total_repaid: number;
  current_exposure: number;
}

export interface CustomerRepaymentRecord {
  installments_paid_on_time: number;
  installments_paid_late: number;
  installments_currently_overdue: number;
  installments_ever_overdue: number;
  payments_verified: number;
  payments_rejected: number;
  payments_awaiting_verification: number;
}

export interface CustomerHistoryApplication {
  id: number;
  submitted_at: string | null;
  amount_requested: number;
  prime_category: string | null;
  status: LoanApplicationStatus;
  decided_at: string | null;
  loan_id: number | null;
}

export interface CustomerHistoryLoan {
  id: number;
  application_id: number | null;
  principal_amount: number;
  total_repayable: number;
  amount_paid: number;
  outstanding: number;
  status: string; // active | overdue | paid | closed
  closure_reason: string | null; // paid_in_full | defaulted
  disbursed_at: string | null;
  due_date: string | null;
  installments: { total: number; paid_on_time: number; paid_late: number; overdue: number };
}

export interface CustomerHistory {
  application_id: number;
  customer: { id: number; full_name: string; member_since: string | null };
  summary: CustomerHistorySummary;
  repayment_record: CustomerRepaymentRecord;
  penalties: { applicable: boolean; note: string | null };
  previous_applications: CustomerHistoryApplication[];
  loans: CustomerHistoryLoan[];
}
