import { describe, expect, it } from "vitest";
import { humanApplicationStatus, isActionRequired, isOpenApplication, isTerminalRejected } from "./loan-wizard";

describe("humanApplicationStatus", () => {
  // This is the single most safety-critical mapping in the whole customer
  // app: the backend's real status enum must never reach the customer
  // verbatim. Prefer application.status_label from a live API response
  // wherever one is available - this local fallback mirrors the backend's
  // own app.services.loan_processing.status_label() mapping exactly.
  it("maps every backend status to the same plain copy the backend's own status_label provides", () => {
    expect(humanApplicationStatus("draft")).toBe("Draft");
    expect(humanApplicationStatus("submitted")).toBe("Submitted");
    expect(humanApplicationStatus("officer_review")).toBe("Under Review");
    expect(humanApplicationStatus("customer_action_required")).toBe("Action Required");
    expect(humanApplicationStatus("recommended_for_approval")).toBe("Under Review");
    expect(humanApplicationStatus("admin_review")).toBe("Under Review");
    expect(humanApplicationStatus("approved")).toBe("Approved");
    expect(humanApplicationStatus("rejected")).toBe("Not Approved");
    expect(humanApplicationStatus("awaiting_disbursement")).toBe("Approved - Processing Disbursement");
  });

  it("never returns a raw/unrecognized status string - always falls back to a safe label", () => {
    const hypotheticalValues = [
      "OFFICER_REVIEW",
      "ADMIN_REVIEW",
      "pending_verification",
      "",
      "under_review ", // trailing space / near-miss should not accidentally match
      "Draft", // case variant should not accidentally match
      "something_new_the_backend_added",
    ];
    for (const value of hypotheticalValues) {
      const result = humanApplicationStatus(value);
      expect(result).not.toBe(value);
    }
  });

  it("defaults unrecognized statuses to 'Under Review' specifically (not a more alarming or more final label)", () => {
    expect(humanApplicationStatus("something_new_the_backend_added")).toBe("Under Review");
  });
});

describe("isTerminalRejected", () => {
  it("is true only for the exact 'rejected' status", () => {
    expect(isTerminalRejected("rejected")).toBe(true);
    expect(isTerminalRejected("officer_review")).toBe(false);
    expect(isTerminalRejected("approved")).toBe(false);
    expect(isTerminalRejected("REJECTED")).toBe(false);
    expect(isTerminalRejected("")).toBe(false);
  });
});

describe("isActionRequired", () => {
  it("is true only for the exact 'customer_action_required' status", () => {
    expect(isActionRequired("customer_action_required")).toBe(true);
    expect(isActionRequired("officer_review")).toBe(false);
    expect(isActionRequired("rejected")).toBe(false);
  });
});

describe("isOpenApplication", () => {
  it("treats approved/rejected/awaiting_disbursement as not-open, everything else as open", () => {
    expect(isOpenApplication("submitted")).toBe(true);
    expect(isOpenApplication("officer_review")).toBe(true);
    expect(isOpenApplication("customer_action_required")).toBe(true);
    expect(isOpenApplication("approved")).toBe(false);
    expect(isOpenApplication("rejected")).toBe(false);
    expect(isOpenApplication("awaiting_disbursement")).toBe(false);
  });
});
