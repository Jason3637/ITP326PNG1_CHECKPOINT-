import { describe, expect, it } from "vitest";
import { customerLoanBadge, isCurrentLoan } from "./loan-status";
import { isApplicationFinished, isOpenApplication, humanApplicationStatus } from "./loan-wizard";
import { staffStatusLabel } from "./officer-queues";

describe("customerLoanBadge", () => {
  it("tells a repaid loan from a written-off one (both are now 'closed')", () => {
    expect(customerLoanBadge({ status: "closed", closure_reason: "paid_in_full" })).toEqual({ label: "Paid off", variant: "success" });
    expect(customerLoanBadge({ status: "closed", closure_reason: "defaulted" })).toEqual({ label: "Written off", variant: "danger" });
    expect(customerLoanBadge({ status: "closed", closure_reason: null })).toEqual({ label: "Closed", variant: "neutral" });
  });

  it("still handles loans closed as 'paid' before the backend change", () => {
    expect(customerLoanBadge({ status: "paid", closure_reason: null }).label).toBe("Paid off");
  });

  it("labels current loans", () => {
    expect(customerLoanBadge({ status: "active", closure_reason: null }).label).toBe("Active");
    expect(customerLoanBadge({ status: "overdue", closure_reason: null })).toEqual({ label: "Overdue", variant: "danger" });
  });
});

describe("isCurrentLoan", () => {
  it("treats overdue as current", () => {
    expect(isCurrentLoan({ status: "active" })).toBe(true);
    expect(isCurrentLoan({ status: "overdue" })).toBe(true);
    expect(isCurrentLoan({ status: "closed" })).toBe(false);
    expect(isCurrentLoan({ status: "paid" })).toBe(false);
  });
});

describe("the 'disbursed' application status", () => {
  it("is labelled and treated as finished", () => {
    expect(humanApplicationStatus("disbursed")).toBe("Disbursed");
    expect(staffStatusLabel("disbursed")).toBe("Disbursed");
    expect(isOpenApplication("disbursed")).toBe(false);
  });
});

describe("isApplicationFinished", () => {
  it("is true once rejected or paid out, on either backend", () => {
    expect(isApplicationFinished({ status: "rejected", loan_id: null })).toBe(true);
    expect(isApplicationFinished({ status: "disbursed", loan_id: 9 })).toBe(true);
    // Current backend: a paid-out application stays awaiting_disbursement, with its loan id.
    expect(isApplicationFinished({ status: "awaiting_disbursement", loan_id: 9 })).toBe(true);
  });

  it("is false while waiting for the payout or still in review", () => {
    expect(isApplicationFinished({ status: "awaiting_disbursement", loan_id: null })).toBe(false);
    expect(isApplicationFinished({ status: "officer_review", loan_id: null })).toBe(false);
  });
});
