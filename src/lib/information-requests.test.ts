import { describe, expect, it } from "vitest";
import {
  EMPTY_REQUEST_DRAFT,
  describeFieldChanges,
  documentNoun,
  groupIntoRounds,
  requestTypeLabel,
  requiredItems,
  validateRequestDraft,
} from "./information-requests";

describe("validateRequestDraft", () => {
  it("needs a type and a customer-facing reason", () => {
    expect(validateRequestDraft(EMPTY_REQUEST_DRAFT)).toEqual({
      request_type: "Choose what kind of request this is.",
      reason: "Tell the customer what's needed and why.",
    });
    expect(validateRequestDraft({ ...EMPTY_REQUEST_DRAFT, request_type: "other", reason: "Please confirm." })).toEqual({});
  });

  it("applies the backend's length limits", () => {
    const errors = validateRequestDraft({
      ...EMPTY_REQUEST_DRAFT,
      request_type: "other",
      reason: "x".repeat(1001),
      required_information: "y".repeat(501),
      internal_note: "z".repeat(1001),
    });
    expect(Object.keys(errors).sort()).toEqual(["internal_note", "reason", "required_information"]);
  });

  it("rejects an unknown type or document type", () => {
    const errors = validateRequestDraft({
      ...EMPTY_REQUEST_DRAFT,
      request_type: "bogus" as never,
      reason: "ok",
      required_document_type: "receipt",
    });
    expect(errors.request_type).toBeDefined();
    expect(errors.required_document_type).toBeDefined();
  });
});

describe("labels", () => {
  it("never shows a raw enum", () => {
    expect(requestTypeLabel("referee_unreachable")).toBe("Referee couldn't be reached");
    expect(requestTypeLabel("something_new")).toBe("Information needed");
    expect(documentNoun("id_verification")).toBe("ID document");
    expect(documentNoun("proof_of_income")).toBe("proof of income");
  });

  it("lists the specific items asked for", () => {
    expect(requiredItems({ required_document_type: "proof_of_income", required_information: "Employer's phone" })).toEqual([
      "Upload: Proof of income",
      "Provide: Employer's phone",
    ]);
    expect(requiredItems({ required_document_type: null, required_information: null })).toEqual([]);
  });
});

describe("describeFieldChanges", () => {
  it("formats the backend's old/new pairs readably", () => {
    expect(
      describeFieldChanges({
        monthly_income: { old: 900, new: 1200 },
        employment_status: { old: null, new: "self_employed" },
        referees: { old: [{ full_name: "Maria Kaupa" }], new: [{ full_name: "John Bani" }] },
      }),
    ).toEqual([
      { label: "Monthly income", from: "K900", to: "K1,200" },
      { label: "Employment status", from: "(blank)", to: "Self-employed" },
      { label: "Referees", from: "Maria Kaupa", to: "John Bani" },
    ]);
    expect(describeFieldChanges(null)).toEqual([]);
  });
});

describe("groupIntoRounds", () => {
  it("groups requests sent together and orders rounds oldest first", () => {
    const rounds = groupIntoRounds([
      { id: 3, requested_at: "2026-09-25T00:00:00+00:00" },
      { id: 1, requested_at: "2026-09-20T00:00:00+00:00" },
      { id: 2, requested_at: "2026-09-20T00:00:00+00:00" },
    ]);
    expect(rounds.map((r) => r.requests.map((x) => x.id))).toEqual([[1, 2], [3]]);
  });
});
