import { describe, expect, it } from "vitest";
import {
  ADMIN_QUEUES,
  adminApplicationHref,
  adminLoanHref,
  adminQueueHref,
  adminRepaymentHref,
  isAdminQueue,
  pageCount,
  recommendationLabel,
} from "./admin-queues";
import { adminNavItems, adminQueueNavItems, isTopNavItemActive } from "./nav";

describe("ADMIN_QUEUES", () => {
  it("covers exactly the backend's seven queues, in workflow order", () => {
    expect(ADMIN_QUEUES.map((q) => q.key)).toEqual([
      "awaiting_decision",
      "awaiting_disbursement",
      "active_loans",
      "due_today",
      "due_this_week",
      "overdue",
      "repayments_awaiting_verification",
    ]);
  });

  it("uses the titles the spec names", () => {
    expect(ADMIN_QUEUES.map((q) => q.title)).toEqual([
      "Applications Awaiting Final Decision",
      "Approved — Awaiting Disbursement",
      "Active Loans",
      "Due Today",
      "Due This Week",
      "Overdue Loans",
      "Repayments Awaiting Verification",
    ]);
  });

  it("recognises only real queue keys", () => {
    expect(isAdminQueue("overdue")).toBe(true);
    expect(isAdminQueue("awaiting_review")).toBe(false); // an officer queue
    expect(isAdminQueue("")).toBe(false);
  });
});

describe("hrefs", () => {
  it("links queues and items inside /admin", () => {
    expect(adminQueueHref("overdue")).toBe("/admin/queues/overdue");
    expect(adminQueueHref("overdue", 1)).toBe("/admin/queues/overdue");
    expect(adminQueueHref("overdue", 3)).toBe("/admin/queues/overdue?page=3");
    expect(adminApplicationHref(8)).toBe("/admin/applications/8");
    expect(adminLoanHref(4)).toBe("/admin/loans/4");
    expect(adminRepaymentHref(12, 5)).toBe("/admin/loans/5/repayments/12");
    expect(adminQueueHref("repayments_awaiting_verification")).toBe("/admin/repayments");
    expect(adminQueueHref("repayments_awaiting_verification", 2)).toBe("/admin/repayments?page=2");
  });

  it("lists every queue in the sidebar, highlighted instead of Overview on its page", () => {
    expect(adminQueueNavItems.map((i) => i.href)).toEqual(ADMIN_QUEUES.map((q) => adminQueueHref(q.key)));
    expect(isTopNavItemActive("/admin", "/admin", "admin")).toBe(true);
    expect(isTopNavItemActive("/admin/queues/overdue", "/admin", "admin")).toBe(false);
  });
});

describe("recommendationLabel / pageCount", () => {
  it("names the officer and the verdict", () => {
    const rec = { id: 1, officer_id: 7, officer_name: "Olive Officer", created_at: null };
    expect(recommendationLabel({ ...rec, recommendation: "recommend_approval" })).toBe("Olive Officer recommends: approve");
    expect(recommendationLabel({ ...rec, recommendation: "recommend_rejection", officer_name: null })).toBe(
      "Officer recommends: reject",
    );
    expect(recommendationLabel(null)).toBeNull();
  });

  it("always has at least one page", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
  });
});

describe("admin nav", () => {
  it("has Overview, Analytics, Settings and Audit log, each highlighted only on its own page", () => {
    expect(adminNavItems.map((i) => i.href)).toEqual(["/admin", "/admin/analytics", "/admin/settings", "/admin/audit-log"]);
    expect(isTopNavItemActive("/admin/analytics", "/admin", "admin")).toBe(false);
    expect(isTopNavItemActive("/admin/analytics", "/admin/analytics", "admin")).toBe(true);
  });
});
