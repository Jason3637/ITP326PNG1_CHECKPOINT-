import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import { recordDisbursement, uploadDisbursementEvidence } from "./admin-disbursement";
import { ApiError } from "@/lib/server-api";

const input = { method: "bsp_mobile_banking" as const, reference: " BSP-TXN-88213 ", disbursedAt: "", note: "" };

describe("recordDisbursement", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
    serverApiFetch.mockResolvedValue({ loan_id: 12, status: "active" });
  });

  it("sends exactly the backend's fields and returns the loan the backend created", async () => {
    expect(await recordDisbursement(8, input, 44)).toEqual({ ok: true, loanId: 12, loanStatus: "active" });
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/applications/8/disbursement", {
      method: "POST",
      body: { method: "bsp_mobile_banking", reference: "BSP-TXN-88213", evidence_document_id: 44 },
    });
  });

  it("refuses a BSP payout without its receipt, without calling the backend", async () => {
    expect(await recordDisbursement(8, input, null)).toEqual({
      ok: false,
      error: "Attach the BSP receipt or screenshot - every BSP payout needs one.",
    });
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("records a cash payout without evidence", async () => {
    expect((await recordDisbursement(8, { ...input, method: "cash_on_hand", reference: "CASH-1" }, null)).ok).toBe(true);
  });

  it("adds the optional time, note and evidence only when given", async () => {
    await recordDisbursement(8, { method: "cash_on_hand", reference: "CASH-ACK-7", disbursedAt: "2026-10-05T09:30", note: " Signed at the counter. " }, 44);
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/applications/8/disbursement", {
      method: "POST",
      body: {
        method: "cash_on_hand",
        reference: "CASH-ACK-7",
        disbursed_at: "2026-10-05T09:30",
        note: "Signed at the counter.",
        evidence_document_id: 44,
      },
    });
  });

  it("never calls the backend without a reference", async () => {
    expect(await recordDisbursement(8, { ...input, reference: "  " }, 44)).toEqual({
      ok: false,
      error: "Enter the BSP transaction number.",
    });
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("explains a second disbursement refused by the backend", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "Application #8 has already been disbursed.");
    });
    const result = await recordDisbursement(8, input, 44);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/isn't awaiting disbursement any more/);
  });

  it("rewords the backend's missing-receipt refusal", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(400, "evidence_document_id is required for BSP Mobile Banking disbursements: upload the BSP receipt first.");
    });
    expect(await recordDisbursement(8, input, 44)).toEqual({
      ok: false,
      error: "Attach the BSP receipt or screenshot - every BSP payout needs one.",
    });
  });

  it("rewords the backend's field-named validation errors", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(400, "disbursed_at can't be in the future.");
    });
    expect(await recordDisbursement(8, input, 44)).toEqual({ ok: false, error: "The payout time can't be in the future." });
  });
});

describe("uploadDisbursementEvidence", () => {
  beforeEach(() => {
    // Block body on purpose - see above.
    serverApiFetch.mockReset();
  });

  const form = (file: File, id = "8") => {
    const f = new FormData();
    f.set("application_id", id);
    f.set("file", file);
    return f;
  };

  it("posts the file to the application's evidence endpoint and returns the document id", async () => {
    serverApiFetch.mockResolvedValue({ id: 44 });
    const file = new File(["%PDF"], "receipt.pdf", { type: "application/pdf" });
    expect(await uploadDisbursementEvidence(form(file))).toEqual({ ok: true, documentId: 44 });
    const [path, opts] = serverApiFetch.mock.calls[0];
    expect(path).toBe("/admin/applications/8/disbursement-evidence");
    expect(opts.method).toBe("POST");
    expect((opts.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("refuses other file types without calling the backend", async () => {
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    expect((await uploadDisbursementEvidence(form(file))).ok).toBe(false);
    expect(serverApiFetch).not.toHaveBeenCalled();
  });
});
