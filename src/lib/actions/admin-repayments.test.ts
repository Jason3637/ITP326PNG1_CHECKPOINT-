import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import { rejectRepayment, verifyRepayment } from "./admin-repayments";
import { ApiError } from "@/lib/server-api";

describe("repayment decisions", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
    serverApiFetch.mockResolvedValue({});
  });

  it("verifies, with the note only when given", async () => {
    expect(await verifyRepayment(4, "")).toEqual({ ok: true, decision: "verified" });
    expect(serverApiFetch).toHaveBeenLastCalledWith("/admin/repayments/4/verify", { method: "POST", body: {} });
    await verifyRepayment(4, " Matched. ");
    expect(serverApiFetch).toHaveBeenLastCalledWith("/admin/repayments/4/verify", { method: "POST", body: { note: "Matched." } });
  });

  it("rejects only with a reason", async () => {
    expect(await rejectRepayment(4, "  ")).toEqual({ ok: false, error: "Give a reason for rejecting this payment." });
    expect(serverApiFetch).not.toHaveBeenCalled();
    expect(await rejectRepayment(4, "No such transaction.")).toEqual({ ok: true, decision: "rejected" });
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/repayments/4/reject", {
      method: "POST",
      body: { reason: "No such transaction." },
    });
  });

  it("explains a second verification refused by the backend", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "Transaction #4 is already verified; only reported/verification_pending transactions can be verified or rejected.");
    });
    expect(await verifyRepayment(4, "")).toEqual({
      ok: false,
      error: "This payment has already been verified or rejected. Refresh to see its current state.",
    });
  });

  it("explains an overpayment refused by the backend", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "This payment (K900.00) is more than the K600.00 outstanding on the loan.");
    });
    const result = await verifyRepayment(4, "");
    expect(!result.ok && result.error).toMatch(/more than the loan's outstanding balance/);
  });
});
