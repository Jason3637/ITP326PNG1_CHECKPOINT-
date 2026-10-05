import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import { savePenaltyPolicy, savePricing } from "./admin-settings";
import { ApiError } from "@/lib/server-api";

const rows = [
  { category: "PRIME 1", min: "100", max: "500", ratePct: "45" },
  { category: "PRIME 2", min: "501", max: "1000", ratePct: "35" },
];

describe("saving pricing and penalties", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
  });

  it("posts a new pricing version with the backend's field names", async () => {
    serverApiFetch.mockResolvedValue({ current: { label: "prime-v2" } });
    expect(await savePricing(rows, " Rates review. ")).toEqual({ ok: true, label: "prime-v2" });
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/pricing", {
      method: "POST",
      body: {
        tiers: [
          { category: "PRIME 1", min_amount: 100, max_amount: 500, interest_rate: 0.45 },
          { category: "PRIME 2", min_amount: 501, max_amount: 1000, interest_rate: 0.35 },
        ],
        note: "Rates review.",
      },
    });
  });

  it("never posts invalid tiers", async () => {
    expect((await savePricing([{ ...rows[0], max: "50" }], "")).ok).toBe(false);
    expect((await savePenaltyPolicy([], "")).ok).toBe(false);
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("posts a new penalty version", async () => {
    serverApiFetch.mockResolvedValue({ current: { label: "penalty-v2" } });
    await savePenaltyPolicy([{ daysLate: "10", pct: "30" }], "");
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/penalty-policy", {
      method: "POST",
      body: { tiers: [{ days_late: 10, pct_of_original_interest: 0.3 }], note: null },
    });
  });

  it("rewords the backend's field names in its validation message", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(400, "tiers[1].interest_rate must be a fraction above 0 and at most 1 (0.40 = 40%).");
    });
    const result = await savePricing(rows, "");
    expect(result).toEqual({ ok: false, error: "Tier 2: interest rate must be a fraction above 0 and at most 1 (0.40 = 40%)." });
  });
});
