// Types mirror the live backend's OpenAPI spec (GET /api/swagger.json) and,
// where the spec left a shape as a generic `object`, what was actually
// observed by walking a real test account through the full flow against
// https://itp326png1checkpointcms-production.up.railway.app. Fields marked
// "unverified" come from the documented envelope only — no live example
// with that field populated was ever produced (it requires a loan_officer
// account to approve an application into an active loan, which this
// project has no credentials for).

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

// ---- Accounts / Dashboard -------------------------------------------------

export interface AccountSummary {
  user_id: number;
  counts: { active: number; completed: number; defaulted: number; total: number };
  // Verified live: empty array with no active loan. Individual item shape
  // was never observed populated (no loan_officer account available to
  // approve a test application) - treated as unverified/best-effort below.
  active_loans: ActiveLoanSummary[];
  next_repayment_due: NextRepaymentDue | null;
  has_overdue: boolean;
}

// Unverified shape - inferred from context (loan detail fields already
// documented elsewhere in the spec), not observed populated.
export interface ActiveLoanSummary {
  loan_id?: number;
  outstanding_balance?: number;
  total_repayable?: number;
  amount_paid?: number;
  status?: string;
  [key: string]: unknown;
}

// Unverified shape.
export interface NextRepaymentDue {
  loan_id?: number;
  due_date?: string;
  amount_due?: number;
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

export type LoanApplicationStatus = "under_review" | "approved" | "rejected" | string;
export type LoanStatus = "active" | "completed" | "defaulted" | string;
export type RepaymentFrequency = "weekly" | "biweekly" | "monthly";
export type InstallmentStatus = "upcoming" | "paid" | "overdue" | string;

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
}

export interface LoanApplyInput {
  amount_requested: number;
  purpose?: string;
  term_months: number;
  repayment_frequency: RepaymentFrequency;
}

export interface LoanApplication {
  id: number;
  user_id: number;
  amount_requested: number;
  purpose: string | null;
  term_months: number;
  repayment_frequency: RepaymentFrequency;
  status: LoanApplicationStatus;
  credit_evaluation_result: CreditEvaluationResult;
  submitted_at: string;
  decided_at: string | null;
  decided_by: number | null;
  loan_id: number | null;
}

export interface RepaymentScheduleItem {
  installment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: InstallmentStatus;
}

export interface Loan {
  id: number;
  application_id: number;
  user_id: number;
  principal_amount: number;
  interest_rate: number;
  term_months: number;
  installment_amount: number;
  total_repayable: number;
  status: LoanStatus;
  disbursed_at: string | null;
  repayment_schedule: RepaymentScheduleItem[];
}

export interface MyLoans {
  count: number;
  loans: Loan[];
}

// ---- Payments ---------------------------------------------------------------

export interface PaymentTransaction {
  id: number;
  loan_id: number;
  repayment_schedule_id: number;
  amount: number;
  payment_method: string;
  status: string;
  paid_at: string;
}

export interface LoanPaymentList {
  loan_id: number;
  count: number;
  payments: PaymentTransaction[];
}
