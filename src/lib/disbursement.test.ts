import { describe, expect, it } from "vitest";
import { isDisbursementMethod, maskAccount, validateDisbursement } from "./disbursement";

const base = { method: "bsp_mobile_banking" as const, reference: "BSP-TXN-1", disbursedAt: "", note: "" };

describe("disbursement rules", () => {
  it("requires the reference for both methods, worded per method", () => {
    expect(validateDisbursement({ ...base, reference: "  " })).toBe("Enter the BSP transaction number.");
    expect(validateDisbursement({ ...base, method: "cash_on_hand", reference: "" })).toBe(
      "Enter the cash acknowledgement number.",
    );
    expect(validateDisbursement(base)).toBeNull();
    expect(validateDisbursement({ ...base, method: "cash_on_hand", reference: "CASH-ACK-1" })).toBeNull();
  });

  it("requires the receipt for BSP only", () => {
    expect(validateDisbursement(base, false)).toMatch(/every BSP payout needs one/);
    expect(validateDisbursement({ ...base, method: "cash_on_hand" }, false)).toBeNull();
  });

  it("keeps to the backend's limits", () => {
    expect(validateDisbursement({ ...base, reference: "x".repeat(256) })).toMatch(/255/);
    expect(validateDisbursement({ ...base, note: "x".repeat(501) })).toMatch(/500/);
  });

  it("accepts a blank or a datetime-local payout time only", () => {
    expect(validateDisbursement({ ...base, disbursedAt: "2026-10-05T09:30" })).toBeNull();
    expect(validateDisbursement({ ...base, disbursedAt: "yesterday" })).toMatch(/date and time/);
  });

  it("knows only the two methods", () => {
    expect(isDisbursementMethod("cash_on_hand")).toBe(true);
    expect(isDisbursementMethod("cheque")).toBe(false);
  });

  it("masks an account like the backend: last four only", () => {
    expect(maskAccount("1001-2345")).toBe("•••• 2345");
    expect(maskAccount("  ")).toBeNull();
    expect(maskAccount(null)).toBeNull();
  });
});
