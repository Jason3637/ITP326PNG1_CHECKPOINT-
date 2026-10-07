import { PURPOSE_CATEGORIES } from "./loan-wizard";
import type { OfficerQueue, QueueAssignmentFilter, QueueItem } from "./types";

export interface QueueDefinition {
  key: OfficerQueue;
  // Section heading on the dashboard and the full queue page.
  title: string;
  // Shorter label for the summary count tile.
  summaryLabel: string;
  // Shown under the heading - what being in this queue means for the officer.
  description: string;
  emptyMessage: string;
}

// Dashboard order follows the workflow: new -> in review -> waiting on the
// customer -> with the administrator -> back from the administrator.
// Keys and the statuses each covers are the backend's own
// (app/services/officer_views.py:QUEUES) - never re-derived here.
export const OFFICER_QUEUES: QueueDefinition[] = [
  {
    key: "awaiting_review",
    title: "Applications Awaiting Review",
    summaryLabel: "New Applications",
    description: "Submitted and not yet claimed by an officer.",
    emptyMessage: "No new applications waiting.",
  },
  {
    key: "under_review",
    title: "Under Review",
    summaryLabel: "Under Review",
    description: "Claimed and being checked by an officer.",
    emptyMessage: "Nothing under review right now.",
  },
  {
    key: "customer_action_required",
    title: "Customer Action Required",
    summaryLabel: "Awaiting Customer Information",
    description: "Waiting on the customer to respond to an information request.",
    emptyMessage: "No applications waiting on a customer.",
  },
  {
    key: "sent_to_admin",
    title: "Recommended / Sent to Administrator",
    summaryLabel: "Sent to Administrator",
    description: "Recommended for approval or rejection, waiting on an administrator's decision.",
    emptyMessage: "Nothing waiting on an administrator.",
  },
  {
    key: "returned_by_admin",
    title: "Returned by Administrator",
    summaryLabel: "Returned for Review",
    description: "Sent back by an administrator for more work before a decision.",
    emptyMessage: "Nothing has been returned for review.",
  },
];

const QUEUE_KEYS = new Set<string>(OFFICER_QUEUES.map((q) => q.key));

export function isOfficerQueue(value: string): value is OfficerQueue {
  return QUEUE_KEYS.has(value);
}

export function queueDefinition(key: OfficerQueue): QueueDefinition {
  return OFFICER_QUEUES.find((q) => q.key === key)!;
}

export const ASSIGNMENT_FILTERS: { value: QueueAssignmentFilter; label: string }[] = [
  { value: "any", label: "All" },
  { value: "me", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
];

export function parseAssignmentFilter(value: string | string[] | undefined): QueueAssignmentFilter {
  return value === "me" || value === "unassigned" ? value : "any";
}

export function parsePage(value: string | string[] | undefined): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// Staff-facing status text. Unlike the customer's status_label (which
// collapses every internal stage into "Under Review"), officers need to
// tell the stages apart - mainly inside sent_to_admin, which covers three.
const STAFF_STATUS_LABELS: Record<string, string> = {
  submitted: "New",
  officer_review: "Under review",
  customer_action_required: "Waiting on customer",
  recommended_for_approval: "Recommended: approve",
  recommended_for_rejection: "Recommended: reject",
  admin_review: "With administrator",
  returned_to_officer: "Returned",
  // Decided/closed states - reached on the review screen for a decided
  // application and in Customer History's previous applications.
  draft: "Draft",
  approved: "Approved",
  awaiting_disbursement: "Approved — Awaiting Disbursement",
  disbursed: "Disbursed",
  rejected: "Rejected",
};

export function staffStatusLabel(status: string): string {
  return STAFF_STATUS_LABELS[status] ?? "In progress";
}

export function purposeLabel(category: string | null): string | null {
  if (!category) return null;
  return PURPOSE_CATEGORIES.find((c) => c.value === category)?.label ?? null;
}

// Whole days since submission - queues are oldest-first, so this is the
// number an officer triages by. A plain helper (see utils.ts:daysUntil)
// so the Date.now() call stays out of component render bodies.
export function daysWaiting(submittedAt: string | null, now: number = Date.now()): number | null {
  if (!submittedAt) return null;
  const elapsed = now - new Date(submittedAt).getTime();
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 86400000)) : null;
}

// Measured from submission, not from entering the current queue (the queue
// item has no "entered this stage at" field) - so it reads as the
// application's age, never as time waiting in this particular stage.
export function waitingLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "Opened today";
  return days === 1 ? "Open for 1 day" : `Open for ${days} days`;
}

export function assignmentLabel(item: Pick<QueueItem, "is_mine" | "assigned_officer_name" | "assigned_officer_id">) {
  if (item.is_mine) return "Assigned to you";
  if (item.assigned_officer_id === null) return "Unassigned";
  return `Assigned to ${item.assigned_officer_name ?? "another officer"}`;
}

export function applicationReviewHref(applicationId: number): string {
  return `/staff/applications/${applicationId}`;
}

export function queueHref(queue: OfficerQueue, opts: { assigned?: QueueAssignmentFilter; page?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.assigned && opts.assigned !== "any") params.set("assigned", opts.assigned);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return `/staff/queues/${queue}${qs ? `?${qs}` : ""}`;
}

// The row's action, from what the officer can do once they open it - the
// detail page still decides what's actually offered (allowed_actions):
//   Review   - a new application, to look at and claim
//   Continue - the officer's own application in a stage they work on
//   View     - everything else (another officer's, or with the administrator)
export type QueueRowAction = "Review" | "Continue" | "View";

const OWN_WORK_STATUSES = new Set(["officer_review", "customer_action_required", "returned_to_officer"]);

export function queueRowAction(item: Pick<QueueItem, "status" | "is_mine">): QueueRowAction {
  if (item.status === "submitted") return "Review";
  if (item.is_mine && OWN_WORK_STATUSES.has(item.status)) return "Continue";
  return "View";
}
