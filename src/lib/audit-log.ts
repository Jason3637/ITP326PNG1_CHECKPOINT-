import type { AdminAuditEntry, AuditLogItem } from "./types";

// Shared by every audit view (a loan's audit history, the full audit log):
// plain labels, the actor's role, and a short summary of named fields.
const AUDIT_LABELS: Record<string, string> = {
  loan_application_submitted: "Application submitted",
  loan_application_admin_review_started: "Administrator review started",
  loan_application_decision: "Final decision",
  loan_application_awaiting_disbursement: "Approved — Awaiting Disbursement",
  loan_application_returned_to_officer: "Returned to the loan officer",
  loan_disbursed: "Disbursed · loan created",
  loan_penalty_applied: "Late penalty added",
  loan_status_changed: "Loan status changed",
  loan_closed: "Loan closed",
  loan_written_off: "Loan written off",
  payment_reported: "Repayment reported by the customer",
  payment_verification_started: "Repayment verification started",
  payment_verified: "Repayment verified",
  payment_rejected: "Repayment rejected",
  repayment_marked_overdue: "Installment marked overdue",
  repayment_reminder_sent: "Repayment reminder sent",
  prime_pricing_version_created: "PRIME pricing changed",
  penalty_policy_version_created: "Late-penalty policy changed",
  system_parameters_updated: "System parameters changed",
  staff_account_created: "Staff account created",
  staff_password_reset: "Staff password reset",
  login_success: "Logged in",
  login_failed: "Login failed",
  mfa_login_failed: "MFA code rejected at login",
  login_denied_inactive: "Login refused: account inactive",
  document_uploaded: "Document uploaded",
  document_download: "Document opened",
  customer_verified: "Customer verified",
  customer_history_viewed: "Customer history viewed",
};

export function auditLabel(action: string): string {
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  const words = action.replaceAll("_", " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Event";
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  loan_officer: "Loan Officer",
  customer: "Customer",
};

export function auditActor(role: string | null): string {
  return role ? (ROLE_LABELS[role] ?? "Staff") : "System";
}

// A few named, human-meaningful fields from the free-form details - never
// the whole dict (it can carry internal ids).
export function auditSummary(entry: Pick<AdminAuditEntry, "details">): string | null {
  const d = entry.details ?? {};
  const parts: string[] = [];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  if (str(d.decision)) parts.push(d.decision === "approve" ? "Approved" : "Rejected");
  if (str(d.from) && str(d.to)) parts.push(`${String(d.from).replaceAll("_", " ")} → ${String(d.to).replaceAll("_", " ")}`);
  if (num(d.amount) !== null) parts.push(`K${num(d.amount)!.toLocaleString("en-US")}`);
  if (str(d.method_reference)) parts.push(`Ref ${str(d.method_reference)}`);
  if (str(d.before_version) && str(d.after_version)) parts.push(`${str(d.before_version)} → ${str(d.after_version)}`);
  for (const key of ["reason", "note"] as const) if (str(d[key])) parts.push(`“${str(d[key])}”`);
  return parts.length ? parts.join(" · ") : null;
}

// ---- full detail (audit log view) --------------------------------------------
// Keys never rendered, whatever the event: file locations and anything
// credential-like.
const HIDDEN_KEY = /(^|_)(storage_path|path|token|password|secret|totp|code|key)$/i;

function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, (k, v) => (k && HIDDEN_KEY.test(k) ? undefined : v));
}

// Every detail field except hidden ones, as label/value pairs.
export function auditDetailRows(details: Record<string, unknown> | null): [string, string][] {
  return Object.entries(details ?? {})
    .filter(([k]) => !HIDDEN_KEY.test(k))
    .map(([k, v]) => [k.replaceAll("_", " "), show(v)]);
}

// Where an entry's subject lives in the admin area, when it has a page.
export function auditEntityHref(entry: Pick<AuditLogItem, "entity_type" | "entity_id" | "details">): string | null {
  const id = entry.entity_id && /^\d+$/.test(entry.entity_id) ? entry.entity_id : null;
  if (!id) return null;
  if (entry.entity_type === "LoanApplication") return `/admin/applications/${id}`;
  if (entry.entity_type === "Loan") return `/admin/loans/${id}`;
  const loanId = entry.details?.loan_id;
  if (entry.entity_type === "PaymentTransaction" && typeof loanId === "number") return `/admin/loans/${loanId}/repayments/${id}`;
  return null;
}

const ENTITY_LABELS: Record<string, string> = {
  LoanApplication: "Application",
  Loan: "Loan",
  PaymentTransaction: "Payment",
  Document: "Document",
  User: "User",
  PrimePricingVersion: "Pricing version",
  PenaltyPolicyVersion: "Penalty version",
};

export function auditEntityLabel(entry: Pick<AuditLogItem, "entity_type" | "entity_id">): string {
  const name = ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;
  return entry.entity_id ? `${name} #${entry.entity_id}` : name;
}

// ---- filters ------------------------------------------------------------------
export const AUDIT_ROLES = [
  { value: "admin", label: "Administrator" },
  { value: "loan_officer", label: "Loan Officer" },
  { value: "customer", label: "Customer" },
] as const;

// The action filter's choices: every action the backend records, grouped.
export const AUDIT_ACTION_GROUPS: { label: string; actions: string[] }[] = [
  {
    label: "Applications",
    actions: [
      "loan_application_submitted", "loan_application_officer_review_started", "loan_application_officer_review_resumed",
      "verification_checklist_opened", "verification_item_updated", "loan_application_customer_action_requested",
      "loan_application_customer_responded", "loan_application_reassigned", "loan_application_admin_review_started",
      "loan_application_decision", "loan_application_returned_to_officer", "loan_application_awaiting_disbursement",
      "customer_history_viewed",
    ],
  },
  {
    label: "Loans & repayments",
    actions: [
      "loan_disbursed", "loan_penalty_applied", "loan_status_changed", "loan_written_off", "loan_closed",
      "payment_reported", "payment_verification_started", "payment_verified", "payment_rejected", "repayment_marked_overdue",
    ],
  },
  {
    label: "Settings & staff",
    actions: ["prime_pricing_version_created", "penalty_policy_version_created", "system_parameters_updated", "staff_account_created", "staff_password_reset"],
  },
  {
    label: "Sign-in & documents",
    actions: ["login_success", "login_failed", "mfa_login_failed", "login_denied_inactive", "document_uploaded", "document_download", "customer_verified"],
  },
];

const KNOWN_ACTIONS = new Set(AUDIT_ACTION_GROUPS.flatMap((g) => g.actions));
const ROLE_VALUES = new Set<string>(AUDIT_ROLES.map((r) => r.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface AuditFilters {
  role: string | null;
  actorId: string | null;
  action: string | null;
  from: string | null;
  to: string | null;
}

type Params = { [key: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function parseAuditFilters(sp: Params): AuditFilters {
  const role = one(sp.role);
  const actorId = one(sp.actor);
  const action = one(sp.action);
  const from = one(sp.from);
  const to = one(sp.to);
  return {
    role: role && ROLE_VALUES.has(role) ? role : null,
    actorId: actorId && /^\d+$/.test(actorId) ? actorId : null,
    action: action && KNOWN_ACTIONS.has(action) ? action : null,
    from: from && ISO_DATE.test(from) ? from : null,
    to: to && ISO_DATE.test(to) ? to : null,
  };
}

// The backend reads a bare date as a UTC day; the screen shows Port Moresby
// time (UTC+10, no daylight saving) - so each chosen day is sent as the UTC
// instants of its Port Moresby start and end. Written in UTC ("+00:00")
// because that compares correctly however the database stores the column
// (an offset like +10:00 is compared as text by SQLite).
const PNG_OFFSET_MS = 10 * 3600 * 1000;

function utcInstant(day: string, endOfDay: boolean): string {
  const localMidnight = Date.parse(`${day}T00:00:00Z`) - PNG_OFFSET_MS;
  const ms = endOfDay ? localMidnight + 86400000 - 1 : localMidnight;
  return new Date(ms).toISOString().replace("Z", "+00:00");
}

export function auditApiQuery(f: AuditFilters, page: number, perPage: number): string {
  const q = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (f.role) q.set("actor_role", f.role);
  if (f.actorId) q.set("actor_id", f.actorId);
  if (f.action) q.set("action", f.action);
  if (f.from) q.set("date_from", utcInstant(f.from, false));
  if (f.to) q.set("date_to", utcInstant(f.to, true));
  return q.toString();
}

export function auditLogHref(f: Partial<AuditFilters>, page = 1): string {
  const q = new URLSearchParams();
  if (f.role) q.set("role", f.role);
  if (f.actorId) q.set("actor", f.actorId);
  if (f.action) q.set("action", f.action);
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  if (page > 1) q.set("page", String(page));
  const qs = q.toString();
  return `/admin/audit-log${qs ? `?${qs}` : ""}`;
}

export function hasFilters(f: AuditFilters): boolean {
  return Boolean(f.role || f.actorId || f.action || f.from || f.to);
}

export type { AdminAuditEntry };
