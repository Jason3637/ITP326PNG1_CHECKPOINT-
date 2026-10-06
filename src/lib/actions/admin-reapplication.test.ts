import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import { clearReapplicationBlock } from "./admin-reapplication";
import { ApiError } from "@/lib/server-api";

describe("clearReapplicationBlock", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
    serverApiFetch.mockResolvedValue({});
  });

  it("posts the trimmed reason", async () => {
    expect(await clearReapplicationBlock(5, "  Reviewed with the member.  ")).toEqual({ ok: true });
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/loans/5/clear-reapplication-block", {
      method: "POST",
      body: { reason: "Reviewed with the member." },
    });
  });

  it("never calls the backend without a reason", async () => {
    expect((await clearReapplicationBlock(5, "   ")).ok).toBe(false);
    expect((await clearReapplicationBlock(5, "x".repeat(1001))).ok).toBe(false);
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("explains the backend's refusals", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "Loan #5 has already been cleared.");
    });
    expect(await clearReapplicationBlock(5, "ok")).toEqual({ ok: false, error: "This loan has already been cleared. Refresh to see who cleared it." });
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "Loan #5 wasn't written off, so it doesn't block the customer from applying.");
    });
    expect(await clearReapplicationBlock(5, "ok")).toEqual({ ok: false, error: "This loan wasn't written off, so there's nothing to clear." });
  });
});
