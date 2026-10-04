import { describe, expect, it } from "vitest";
import {
  adminLoanStatus,
  auditActor,
  auditLabel,
  auditSummary,
  canDecidePayment,
  ledgerEntryLabel,
  ledgerWithBalance,
  signedKina,
} from "./admin-loans";
import { loanDetail } from "@/components/admin/admin-fixtures.test-utils";
import type { AdminLedgerEntry } from "./types";

describe("adminLoanStatus", () => {
  it("says Loan Active only for an active loan", () => {
    expect(adminLoanStatus({ status: "active", closure: null }).label).toBe("Loan Active");
    expect(adminLoanStatus({ status: "overdue", closure: null }).label).toBe("Loan Overdue");
    expect(adminLoanStatus({ status: "closed", closure: { closure_reason: "paid_in_full" } as never }).label).toBe("Closed · Paid in full");
    expect(adminLoanStatus({ status: "closed", closure: { closure_reason: "defaulted" } as never }).label).toBe("Closed · Written off");
  });
});

describe("ledger", () => {
  const entries = loanDetail().ledger as AdminLedgerEntry[];

  it("keeps append order (entry id), not effective-date order", () => {
    const late = { ...entries[2], id: 20, effective_date: "2026-01-01" }; // appended last, dated earliest
    expect(ledgerWithBalance([late, ...entries]).map((r) => r.entry.id)).toEqual([10, 11, 12, 20]);
  });

  it("tells the story in append order with the balance after each line", () => {
    const rows = ledgerWithBalance(entries);
    expect(rows.map((r) => r.entry.id)).toEqual([10, 11, 12]);
    expect(rows.map((r) => r.balanceAfter)).toEqual([840, 540, 600]);
  });

  it("labels each kind of entry plainly", () => {
    expect(ledgerEntryLabel(entries[1])).toBe("Original amount owed (principal + interest)");
    expect(ledgerEntryLabel(entries[2])).toBe("Late penalty, tier 1");
    expect(ledgerEntryLabel(entries[0])).toBe("Verified repayment · payment #3");
  });

  it("signs amounts: owed is +, paid is −", () => {
    expect(signedKina(840)).toBe("+ K840");
    expect(signedKina(-300)).toBe("− K300");
  });

  it("adds cents without float drift", () => {
    const e = (id: number, amount: number) => ({ ...entries[1], id, amount, effective_date: "2026-09-10" });
    expect(ledgerWithBalance([e(1, 0.1), e(2, 0.2)]).at(-1)!.balanceAfter).toBe(0.3);
  });
});

describe("payments", () => {
  it("can be decided only while reported or verification pending", () => {
    expect(canDecidePayment("reported")).toBe(true);
    expect(canDecidePayment("verification_pending")).toBe(true);
    expect(canDecidePayment("verified")).toBe(false);
    expect(canDecidePayment("rejected")).toBe(false);
  });
});

describe("audit history", () => {
  it("labels known actions and humanises unknown ones", () => {
    expect(auditLabel("payment_verified")).toBe("Repayment verified");
    expect(auditLabel("something_new_happened")).toBe("Something new happened");
    expect(auditActor("admin")).toBe("Administrator");
    expect(auditActor(null)).toBe("System");
  });

  it("shows only named, human fields from the details - never ids or paths", () => {
    const [disbursed, rejected, penalty] = loanDetail().audit_history;
    expect(auditSummary(disbursed)).toBe("Ref CASH-ACK-0042");
    expect(auditSummary(rejected)).toBe("“No such BSP transaction.”");
    expect(auditSummary(penalty)).toBe("K60");
    expect(auditSummary({ details: { storage_path: "x", loan_id: 5 } })).toBeNull();
  });
});
