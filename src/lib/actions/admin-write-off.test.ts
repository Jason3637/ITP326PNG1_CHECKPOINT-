import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import { writeOffLoan } from "./admin-write-off";
import { ApiError } from "@/lib/server-api";

describe("writeOffLoan", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
    serverApiFetch.mockResolvedValue({});
  });

  it("posts the trimmed reason", async () => {
    expect(await writeOffLoan(5, "  Unreachable for 60 days.  ")).toEqual({ ok: true });
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/loans/5/write-off", { method: "POST", body: { reason: "Unreachable for 60 days." } });
  });

  it("never calls the backend without a reason", async () => {
    expect((await writeOffLoan(5, " ")).ok).toBe(false);
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("explains the backend's refusals", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "Loan #5 has nothing outstanding to write off.");
    });
    expect(await writeOffLoan(5, "x")).toEqual({ ok: false, error: "Nothing is owed on this loan any more, so there's nothing to write off." });
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "Loan #5 is closed; only active/overdue loans can be written off.");
    });
    expect(await writeOffLoan(5, "x")).toEqual({ ok: false, error: "This loan is already closed. Refresh to see its current state." });
  });
});
