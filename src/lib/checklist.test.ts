import { describe, expect, it } from "vitest";
import {
  awaitedDocumentTypes,
  checklistLockedReason,
  documentProvenance,
  pickChecklist,
  replacementOf,
  validateChecklistDraft,
} from "./checklist";
import type { ReviewChecklist, ReviewDocument, ReviewInformationRequest } from "./types";

describe("validateChecklistDraft", () => {
  it("allows verified/unchecked with or without a note", () => {
    expect(validateChecklistDraft("verified", "")).toBeNull();
    expect(validateChecklistDraft("verified", "Checked against NID card.")).toBeNull();
    expect(validateChecklistDraft("pending", "")).toBeNull();
  });

  it("requires a note for problem and not-applicable, like the backend", () => {
    expect(validateChecklistDraft("failed", "  ")).toMatch(/what the problem is/);
    expect(validateChecklistDraft("not_applicable", "")).toMatch(/why this doesn't apply/);
    expect(validateChecklistDraft("failed", "ID expired")).toBeNull();
  });

  it("caps the note at the backend's 1000 characters", () => {
    expect(validateChecklistDraft("verified", "x".repeat(1001))).toMatch(/under 1000/);
    expect(validateChecklistDraft("verified", "x".repeat(1000))).toBeNull();
  });
});

describe("checklistLockedReason", () => {
  const base = { started: true, status: "officer_review", isMine: true, officerName: "Olive" };

  it("explains each read-only situation", () => {
    expect(checklistLockedReason({ ...base, started: false, status: "submitted" })).toMatch(/claims this application/);
    expect(checklistLockedReason({ ...base, status: "returned_to_officer" })).toMatch(/Resume the review/);
    expect(checklistLockedReason({ ...base, status: "admin_review" })).toMatch(/with the administrator/);
    expect(checklistLockedReason({ ...base, isMine: false, officerName: "Oscar Other" })).toBe(
      "Assigned to Oscar Other. Only they or an administrator can update these checks.",
    );
  });
});

const response = (r: { responded_at: string | null; provided_document_ids: number[] | null }) => ({
  response_note: "Done.",
  field_changes: null,
  ...r,
});

const request = (overrides: Partial<ReviewInformationRequest>): ReviewInformationRequest => ({
  id: 1,
  request_type: "document_expired",
  reason: "Upload a current payslip.",
  required_document_type: "proof_of_income",
  required_information: null,
  internal_note: null,
  status: "responded",
  requested_at: "2026-09-20T00:00:00Z",
  requested_by_name: "Olive Officer",
  cancelled_at: null,
  cancel_reason: null,
  response: response({ responded_at: "2026-09-21T00:00:00Z", provided_document_ids: [41] }),
  ...overrides,
});

describe("documentProvenance", () => {
  it("maps each provided document to the request round it answered", () => {
    const map = documentProvenance([
      request({}),
      request({ id: 2, reason: "Clearer ID please.", response: response({ responded_at: null, provided_document_ids: [50, 51] }) }),
      request({ id: 3, status: "open", response: null }),
    ]);
    expect(map.get(41)).toEqual({ requestId: 1, reason: "Upload a current payslip.", respondedAt: "2026-09-21T00:00:00Z" });
    expect(map.get(51)?.requestId).toBe(2);
    expect(map.has(99)).toBe(false);
  });

  it("credits the request that asked for that document type, not just the first in the round", () => {
    const round = [
      request({ id: 4, request_type: "referee_unreachable", required_document_type: null, reason: "Referee?" }),
      request({ id: 5, reason: "Payslip please." }),
    ].map((r) => ({ ...r, response: response({ responded_at: null, provided_document_ids: [41] }) }));
    expect(documentProvenance(round, new Map([[41, "proof_of_income"]])).get(41)?.requestId).toBe(5);
    expect(documentProvenance(round).get(41)?.requestId).toBe(4);
  });

  it("tolerates a response with no provided documents", () => {
    expect(documentProvenance([request({ response: response({ responded_at: null, provided_document_ids: null }) })]).size).toBe(0);
  });
});

describe("awaitedDocumentTypes", () => {
  it("only counts open requests that name a document type", () => {
    const types = awaitedDocumentTypes([
      request({ status: "open", required_document_type: "id_verification", response: null }),
      request({ status: "open", required_document_type: null, response: null }),
      request({ status: "responded", required_document_type: "proof_of_income" }),
      request({ status: "cancelled", required_document_type: "loan_file", response: null }),
    ]);
    expect([...types]).toEqual(["id_verification"]);
  });
});

describe("replacementOf", () => {
  const doc = (id: number, superseded_by_id: number | null): ReviewDocument => ({
    id,
    loan_application_id: 12,
    document_type: "proof_of_income",
    uploaded_at: null,
    is_current: superseded_by_id === null,
    superseded_by_id,
    linked_to_this_application: true,
  });

  it("finds the newer version, or null when unknown or current", () => {
    const all = [doc(1, 2), doc(2, null)];
    expect(replacementOf(all[0], all)?.id).toBe(2);
    expect(replacementOf(all[1], all)).toBeNull();
    expect(replacementOf(doc(3, 99), all)).toBeNull();
  });
});

describe("pickChecklist", () => {
  it("drops fields the UI doesn't render before they reach the browser", () => {
    const raw = {
      application_id: 12,
      started: true,
      items: [
        {
          item_type: "valid_id",
          label: "Valid ID checked",
          required: true,
          status: "verified",
          note: "ok",
          checked_by: 3,
          checked_by_name: "Olive Officer",
          checked_at: "2026-09-28T00:00:00Z",
          customer_verification_id: 9,
        },
      ],
      summary: {
        total: 1,
        required: 1,
        required_complete: 1,
        pending: 0,
        failed: 0,
        blocking_items: [],
        ready_for_approval_recommendation: true,
      },
    } as unknown as ReviewChecklist;
    const picked = pickChecklist(raw);
    expect(Object.keys(picked.items[0]).sort()).toEqual(
      ["checked_at", "checked_by_name", "item_type", "label", "note", "required", "status"].sort(),
    );
    expect(picked).not.toHaveProperty("application_id");
    expect(picked.summary).not.toHaveProperty("pending");
  });
});
