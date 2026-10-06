import type { AdminApplicationItem, AdminQueue, AdminQueueKind } from "./types";

export interface AdminQueueDefinition {
  key: AdminQueue;
  kind: AdminQueueKind;
  // Section heading on the dashboard and the full queue page.
  title: string;
  // Short label for the sidebar.
  navLabel: string;
  description: string;
  emptyMessage: string;
}

// Dashboard order follows the work: decide -> pay out -> loans running ->
// due -> overdue -> repayments to check. Keys, what each queue contains and
// its counts are the backend's (app/services/admin_views.py:QUEUES) - never
// re-derived here.
export const ADMIN_QUEUES: AdminQueueDefinition[] = [
  {
    key: "awaiting_decision",
    kind: "application",
    title: "Applications Awaiting Final Decision",
    navLabel: "Final decisions",
    description: "Recommended by a loan officer and waiting on your approval or rejection.",
    emptyMessage: "No applications are waiting on a decision.",
  },
  {
    key: "awaiting_disbursement",
    kind: "application",
    title: "Approved — Awaiting Disbursement",
    navLabel: "To disburse",
    description: "Approved and waiting to be paid out.",
    emptyMessage: "No approved loans are waiting to be paid out.",
  },
  {
    key: "active_loans",
    kind: "loan",
    title: "Active Loans",
    navLabel: "Active loans",
    description: "Paid out and not yet closed, overdue loans included.",
    emptyMessage: "No active loans.",
  },
  {
    key: "due_today",
    kind: "loan",
    title: "Due Today",
    navLabel: "Due today",
    description: "Due today with a balance still owing.",
    emptyMessage: "Nothing is due today.",
  },
  {
    key: "due_this_week",
    kind: "loan",
    title: "Due This Week",
    navLabel: "Due this week",
    description: "Due today or in the next 6 days with a balance still owing.",
    emptyMessage: "Nothing is due in the next 7 days.",
  },
  {
    key: "overdue",
    kind: "loan",
    title: "Overdue Loans",
    navLabel: "Overdue",
    description: "Past their due date with a balance still owing.",
    emptyMessage: "No loans are overdue.",
  },
  {
    key: "repayments_awaiting_verification",
    kind: "repayment",
    title: "Repayments Awaiting Verification",
    // Sits under a "Repayments" heading in the sidebar.
    navLabel: "To verify",
    description: "Reported by customers. Not counted against a balance until verified.",
    emptyMessage: "No repayments are waiting to be verified.",
  },
];

const QUEUE_KEYS = new Set<string>(ADMIN_QUEUES.map((q) => q.key));

export function isAdminQueue(value: string): value is AdminQueue {
  return QUEUE_KEYS.has(value);
}

export function adminQueueDefinition(key: AdminQueue): AdminQueueDefinition {
  return ADMIN_QUEUES.find((q) => q.key === key)!;
}

export function adminQueueHref(queue: AdminQueue, page = 1): string {
  // Repayments have their own queue screen (with status filters).
  if (queue === "repayments_awaiting_verification") return adminRepaymentsHref("awaiting", page);
  return `/admin/queues/${queue}${page > 1 ? `?page=${page}` : ""}`;
}

export type RepaymentFilter = "awaiting" | "verified" | "rejected" | "all";

export function adminRepaymentsHref(status: RepaymentFilter = "awaiting", page = 1): string {
  const params = new URLSearchParams();
  if (status !== "awaiting") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/admin/repayments${qs ? `?${qs}` : ""}`;
}

// Where each kind of queue item opens. One place, so the detail
// workspaces (final review and disbursement, loan detail, repayment
// verification) can settle their URLs without touching the queues.
export function adminApplicationHref(applicationId: number): string {
  return `/admin/applications/${applicationId}`;
}

export function adminLoanHref(loanId: number): string {
  return `/admin/loans/${loanId}`;
}

// Under its loan: the backend has no single-payment endpoint, so the
// workspace reads the payment from GET /admin/loans/<loanId>.
export function adminRepaymentHref(paymentId: number, loanId: number): string {
  return `/admin/loans/${loanId}/repayments/${paymentId}`;
}

export function recommendationLabel(rec: AdminApplicationItem["recommendation"]): string | null {
  if (!rec) return null;
  const verdict = rec.recommendation === "recommend_approval" ? "approve" : "reject";
  return rec.officer_name ? `${rec.officer_name} recommends: ${verdict}` : `Officer recommends: ${verdict}`;
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, perPage)));
}
