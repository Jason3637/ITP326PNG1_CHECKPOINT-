import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});
const setLastApplicationDraft = vi.fn();
vi.mock("@/lib/session", () => ({ setLastApplicationDraft: (...a: unknown[]) => setLastApplicationDraft(...a) }));

import { applyForLoan, type WizardApplyInput } from "@/app/(dashboard)/dashboard/loans/apply/actions";
import { uploadLoanDocument } from "./documents";

// Regression: the apply form now sends residence, employer and the ID type
// the backend needs for the Application Review screen.

const input = (overrides: Partial<WizardApplyInput> = {}): WizardApplyInput => ({
  amountRequested: 750,
  monthlyIncome: 1400,
  employmentStatus: "employed",
  existingMonthlyDebt: 100,
  residentialAddress: "  Section 54, Lot 12, Hohola, Port Moresby, NCD ",
  employerName: " Digicel PNG ",
  category: "school_fees",
  otherDescription: "",
  disbursementMethod: "cash_on_hand",
  bspMobileNumber: "",
  referee: { full_name: "Joe Kila", relationship: "brother", mobile_number: "+675 7000 0004" },
  termsAccepted: true,
  confirmedFullName: "Kila Third",
  confirmedEmail: "kila@example.com",
  confirmedPhoneNumber: "",
  documentIds: [41],
  ...overrides,
});

beforeEach(() => {
  serverApiFetch.mockReset();
  setLastApplicationDraft.mockReset();
});

describe("applyForLoan sends the applicant's residence and employer", () => {
  it("includes both, trimmed", async () => {
    serverApiFetch.mockResolvedValue({ id: 3 });
    expect(await applyForLoan(input())).toMatchObject({ ok: true });
    const body = serverApiFetch.mock.calls[0][1].body;
    expect(body.residential_address).toBe("Section 54, Lot 12, Hohola, Port Moresby, NCD");
    expect(body.employer_name).toBe("Digicel PNG");
  });

  it("omits the employer when the applicant isn't working", async () => {
    serverApiFetch.mockResolvedValue({ id: 3 });
    await applyForLoan(input({ employmentStatus: "student", employerName: "" }));
    expect(serverApiFetch.mock.calls[0][1].body.employer_name).toBeUndefined();
  });

  it("refuses to submit without a residence, or without an employer when working", async () => {
    expect(await applyForLoan(input({ residentialAddress: "  " }))).toEqual({
      ok: false,
      error: "Enter your residential address.",
    });
    expect(await applyForLoan(input({ employerName: "" }))).toEqual({ ok: false, error: "Enter your employer's name." });
    expect(await applyForLoan(input({ employmentStatus: "self_employed", employerName: "" }))).toEqual({
      ok: false,
      error: "Enter your business name.",
    });
    expect(serverApiFetch).not.toHaveBeenCalled();
  });
});

describe("uploadLoanDocument sends the ID type", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    f.set("file", new File(["x".repeat(64)], "national_id-scan.png", { type: "image/png" }));
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };

  it("forwards id_document_type for an ID document", async () => {
    serverApiFetch.mockResolvedValue({ id: 41 });
    await uploadLoanDocument(form({ document_type: "id_verification", id_document_type: "national_id" }));
    const sent: FormData = serverApiFetch.mock.calls[0][1].body;
    expect(sent.get("id_document_type")).toBe("national_id");
  });

  it("rejects an unknown ID type, or an ID type on a non-ID document", async () => {
    expect(await uploadLoanDocument(form({ document_type: "id_verification", id_document_type: "selfie" }))).toMatchObject({
      ok: false,
    });
    expect(await uploadLoanDocument(form({ document_type: "receipt", id_document_type: "passport" }))).toMatchObject({
      ok: false,
    });
    expect(serverApiFetch).not.toHaveBeenCalled();
  });
});
