import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import { decideApplication } from "./admin-decisions";
import { ApiError } from "@/lib/server-api";

describe("decideApplication", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
    serverApiFetch.mockResolvedValue({});
  });

  it("approves with no body when the officer recommended approval", async () => {
    expect(await decideApplication(8, "approve", "ignored", "recommend_approval")).toEqual({ ok: true, outcome: "approved" });
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/applications/8/approve", { method: "POST", body: { note: "ignored" } });
  });

  it("sends the note when approving against a recommendation to reject", async () => {
    await decideApplication(8, "approve", "  Employer confirmed.  ", "recommend_rejection");
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/applications/8/approve", {
      method: "POST",
      body: { note: "Employer confirmed." },
    });
  });

  it("rejects and returns with the trimmed reason", async () => {
    expect(await decideApplication(8, "reject", " Income unverified. ", null)).toEqual({ ok: true, outcome: "rejected" });
    expect(serverApiFetch).toHaveBeenLastCalledWith("/admin/applications/8/reject", {
      method: "POST",
      body: { reason: "Income unverified." },
    });
    expect(await decideApplication(8, "return", "Check the payslip.", null)).toEqual({ ok: true, outcome: "returned" });
    expect(serverApiFetch).toHaveBeenLastCalledWith("/admin/applications/8/return-to-officer", {
      method: "POST",
      body: { reason: "Check the payslip." },
    });
  });

  it("never calls the backend without a required reason", async () => {
    expect(await decideApplication(8, "reject", "   ", null)).toEqual({ ok: false, error: "Give a reason for rejecting." });
    expect((await decideApplication(8, "approve", "", "recommend_rejection")).ok).toBe(false);
    expect((await decideApplication(0, "reject", "x", null)).ok).toBe(false);
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("explains a decision the backend refuses because the application moved on", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "Application #8 is already rejected.");
    });
    const result = await decideApplication(8, "approve", "", null);
    expect(result).toEqual({
      ok: false,
      error: "This application isn't waiting on a final decision any more. Refresh to see where it is.",
    });
  });
});
