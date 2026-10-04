import { describe, expect, it } from "vitest";
import { OUTCOME_STATUS, approvalNeedsNote, outcomeFor, parseOutcome, textRequired, validateDecision } from "./admin-decisions";

describe("admin decision rules", () => {
  it("always requires a reason to reject or return", () => {
    expect(validateDecision("reject", "  ", "recommend_rejection")).toBe("Give a reason for rejecting.");
    expect(validateDecision("return", "", "recommend_approval")).toBe("Tell the loan officer why it's coming back.");
    expect(validateDecision("reject", "Income unverified.", "recommend_approval")).toBeNull();
    expect(validateDecision("return", "Check the payslip.", null)).toBeNull();
  });

  it("needs a note only to approve against a recommendation to reject", () => {
    expect(approvalNeedsNote("recommend_rejection")).toBe(true);
    expect(approvalNeedsNote("recommend_approval")).toBe(false);
    expect(approvalNeedsNote(null)).toBe(false);
    expect(textRequired("approve", "recommend_approval")).toBe(false);
    expect(validateDecision("approve", "", "recommend_approval")).toBeNull();
    expect(validateDecision("approve", "", "recommend_rejection")).toMatch(/against the officer's recommendation/);
    expect(validateDecision("approve", "Employer confirmed by phone.", "recommend_rejection")).toBeNull();
  });

  it("caps the text at the backend's 2000 characters", () => {
    expect(validateDecision("reject", "x".repeat(2001), null)).toMatch(/2000/);
  });

  it("maps decisions to outcomes and outcomes to the status they produce", () => {
    expect(outcomeFor("approve")).toBe("approved");
    expect(OUTCOME_STATUS.approved).toBe("awaiting_disbursement");
    expect(OUTCOME_STATUS.returned).toBe("returned_to_officer");
    expect(parseOutcome("approved")).toBe("approved");
    expect(parseOutcome("active")).toBeNull();
    expect(parseOutcome(["approved"])).toBeNull();
  });
});
