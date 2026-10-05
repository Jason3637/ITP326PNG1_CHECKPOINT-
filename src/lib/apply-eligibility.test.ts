import { describe, expect, it } from "vitest";
import { applyBlock } from "./apply-eligibility";

const app = (id: number, status: string, loan_id: number | null = null) => ({ id, status, loan_id }) as never;
const loan = (id: number, status: string, closure_reason: string | null = null) => ({ id, status, closure_reason }) as never;

describe("applyBlock - one PRIME loan at a time, as the backend checks it", () => {
  it("blocks an open application with the backend's wording", () => {
    for (const s of ["submitted", "officer_review", "customer_action_required", "recommended_for_approval", "recommended_for_rejection", "admin_review", "returned_to_officer"]) {
      expect(applyBlock([app(4, s)], [])?.message).toBe("You already have an open application (#4).");
    }
  });

  it("blocks an application approved and waiting to be paid out", () => {
    const msg = "Your application #5 is approved and waiting to be paid out. You can apply again once that loan is fully repaid.";
    expect(applyBlock([app(5, "approved")], [])?.message).toBe(msg);
    expect(applyBlock([app(5, "awaiting_disbursement")], [])?.message).toBe(msg);
  });

  it("lets the loan decide once an application has been paid out", () => {
    // Older backends leave a paid-out application at awaiting_disbursement + loan_id.
    expect(applyBlock([app(5, "awaiting_disbursement", 21)], [loan(21, "closed", "paid_in_full")])).toBeNull();
    expect(applyBlock([app(5, "disbursed", 21)], [loan(21, "closed", "paid_in_full")])).toBeNull();
  });

  it("blocks an active or overdue loan", () => {
    const msg = "You still have a loan (#21) to repay. You can apply again once it's fully repaid.";
    expect(applyBlock([app(5, "disbursed", 21)], [loan(21, "active")])?.message).toBe(msg);
    expect(applyBlock([], [loan(21, "overdue")])?.message).toBe(msg);
    expect(applyBlock([], [loan(21, "overdue")])?.href).toBe("/dashboard/loans");
  });

  it("never blocks on a rejected application or a closed loan - paid in full or written off", () => {
    expect(applyBlock([app(6, "rejected")], [])).toBeNull();
    expect(applyBlock([], [loan(21, "closed", "paid_in_full")])).toBeNull();
    expect(applyBlock([], [loan(21, "closed", "defaulted")])).toBeNull();
    expect(applyBlock([], [loan(21, "paid")])).toBeNull();
    expect(applyBlock([], [])).toBeNull();
  });

  it("checks in the backend's order: an open application before a current loan", () => {
    expect(applyBlock([app(4, "submitted")], [loan(21, "active")])?.kind).toBe("open_application");
  });
});
