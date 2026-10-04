import { describe, expect, it } from "vitest";
import {
  OFFICER_QUEUES,
  assignmentLabel,
  daysWaiting,
  isOfficerQueue,
  parseAssignmentFilter,
  parsePage,
  queueHref,
  staffStatusLabel,
  waitingLabel,
} from "./officer-queues";

describe("OFFICER_QUEUES", () => {
  it("covers exactly the backend's five queues, in workflow order", () => {
    expect(OFFICER_QUEUES.map((q) => q.key)).toEqual([
      "awaiting_review",
      "under_review",
      "customer_action_required",
      "sent_to_admin",
      "returned_by_admin",
    ]);
  });

  it("uses the required summary labels", () => {
    expect(OFFICER_QUEUES.map((q) => q.summaryLabel)).toEqual([
      "New Applications",
      "Under Review",
      "Awaiting Customer Information",
      "Sent to Administrator",
      "Returned for Review",
    ]);
  });
});

describe("isOfficerQueue", () => {
  it("accepts real queue keys only", () => {
    expect(isOfficerQueue("under_review")).toBe(true);
    expect(isOfficerQueue("approved")).toBe(false);
    expect(isOfficerQueue("")).toBe(false);
  });
});

describe("URL params", () => {
  it("falls back to 'any' for an unknown assignment filter", () => {
    expect(parseAssignmentFilter("me")).toBe("me");
    expect(parseAssignmentFilter("unassigned")).toBe("unassigned");
    expect(parseAssignmentFilter("someone_else")).toBe("any");
    expect(parseAssignmentFilter(["me", "unassigned"])).toBe("any");
    expect(parseAssignmentFilter(undefined)).toBe("any");
  });

  it("falls back to page 1 for anything that isn't a positive integer", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("builds queue links with only the non-default params", () => {
    expect(queueHref("under_review")).toBe("/staff/queues/under_review");
    expect(queueHref("under_review", { assigned: "any", page: 1 })).toBe("/staff/queues/under_review");
    expect(queueHref("under_review", { assigned: "me", page: 2 })).toBe(
      "/staff/queues/under_review?assigned=me&page=2",
    );
  });
});

describe("staffStatusLabel", () => {
  it("tells the sent_to_admin stages apart", () => {
    expect(staffStatusLabel("recommended_for_approval")).toBe("Recommended: approve");
    expect(staffStatusLabel("recommended_for_rejection")).toBe("Recommended: reject");
    expect(staffStatusLabel("admin_review")).toBe("With administrator");
  });

  it("labels decided states rather than calling them in progress", () => {
    expect(staffStatusLabel("rejected")).toBe("Rejected");
    expect(staffStatusLabel("awaiting_disbursement")).toBe("Approved — Awaiting Disbursement");
  });

  it("never shows a raw status value", () => {
    expect(staffStatusLabel("something_new")).toBe("In progress");
  });
});

describe("daysWaiting / waitingLabel", () => {
  const now = new Date("2026-10-10T12:00:00Z").getTime();

  it("counts whole days since submission", () => {
    expect(daysWaiting("2026-10-10T08:00:00Z", now)).toBe(0);
    expect(daysWaiting("2026-10-09T08:00:00Z", now)).toBe(1);
    expect(daysWaiting("2026-10-01T12:00:00Z", now)).toBe(9);
  });

  it("handles missing, invalid and future dates", () => {
    expect(daysWaiting(null, now)).toBeNull();
    expect(daysWaiting("not a date", now)).toBeNull();
    expect(daysWaiting("2026-10-11T00:00:00Z", now)).toBe(0);
  });

  it("labels the result", () => {
    expect(waitingLabel(0)).toBe("Opened today");
    expect(waitingLabel(1)).toBe("Open for 1 day");
    expect(waitingLabel(9)).toBe("Open for 9 days");
    expect(waitingLabel(null)).toBeNull();
  });
});

describe("assignmentLabel", () => {
  it("distinguishes yours, unassigned and another officer's", () => {
    expect(assignmentLabel({ is_mine: true, assigned_officer_id: 1, assigned_officer_name: "Olive" })).toBe(
      "Assigned to you",
    );
    expect(assignmentLabel({ is_mine: false, assigned_officer_id: null, assigned_officer_name: null })).toBe(
      "Unassigned",
    );
    expect(assignmentLabel({ is_mine: false, assigned_officer_id: 2, assigned_officer_name: "Ben" })).toBe(
      "Assigned to Ben",
    );
  });
});
