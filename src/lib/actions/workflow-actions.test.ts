import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import { requestMoreInformation } from "./information-requests";
import { submitRecommendation } from "./recommendations";
import { updateChecklistItem } from "./checklist";
import { respondToActionRequired } from "@/app/(dashboard)/dashboard/applications/[applicationId]/respond/actions";
import { ApiError, UnauthenticatedError } from "@/lib/server-api";
import { EMPTY_REQUEST_DRAFT } from "@/lib/information-requests";

const rejectWith = (err: Error) =>
  serverApiFetch.mockImplementation(async () => {
    throw err;
  });

beforeEach(() => {
  serverApiFetch.mockReset();
});

describe("requestMoreInformation (officer)", () => {
  const draft = {
    ...EMPTY_REQUEST_DRAFT,
    request_type: "document_expired" as const,
    reason: "  Your payslip is from 2024.  ",
    required_document_type: "proof_of_income" as const,
    internal_note: "HR confirmed.",
  };

  it("sends one round with each item, trimmed, empty optionals omitted", async () => {
    serverApiFetch.mockResolvedValue({});
    const result = await requestMoreInformation(9, [draft, { ...EMPTY_REQUEST_DRAFT, request_type: "other", reason: "Confirm employer." }]);
    expect(result).toEqual({ ok: true, requestCount: 2 });
    expect(serverApiFetch).toHaveBeenCalledWith("/loans/applications/9/request-action", {
      method: "POST",
      body: {
        requests: [
          { request_type: "document_expired", reason: "Your payslip is from 2024.", required_document_type: "proof_of_income", required_information: undefined, internal_note: "HR confirmed." },
          { request_type: "other", reason: "Confirm employer.", required_document_type: undefined, required_information: undefined, internal_note: undefined },
        ],
      },
    });
  });

  it("validates before calling the backend", async () => {
    expect(await requestMoreInformation(9, [])).toMatchObject({ ok: false });
    expect(await requestMoreInformation(9, [EMPTY_REQUEST_DRAFT])).toMatchObject({ ok: false });
    expect(await requestMoreInformation(9, Array(11).fill(draft))).toMatchObject({ ok: false, error: /at most 10/ });
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("maps backend refusals to clear messages", async () => {
    rejectWith(new ApiError(403, "Assigned to another officer"));
    expect(await requestMoreInformation(9, [draft])).toEqual({ ok: false, error: "Only the assigned officer or an administrator can request information." });
    rejectWith(new ApiError(409, "Application is not in OFFICER_REVIEW"));
    expect(await requestMoreInformation(9, [draft])).toMatchObject({ ok: false, error: /isn't under review any more/ });
    rejectWith(new UnauthenticatedError());
    expect(await requestMoreInformation(9, [draft])).toMatchObject({ ok: false, error: /session expired/ });
  });
});

describe("respondToActionRequired (customer)", () => {
  it("answers each open request by id on the same application", async () => {
    serverApiFetch.mockResolvedValue({ id: 9, status: "officer_review" });
    const result = await respondToActionRequired({
      applicationId: 9,
      responses: [
        { information_request_id: 4, response_note: " Attached. " },
        { information_request_id: 5, response_note: "New number 7000 1111." },
      ],
      documentIds: [6],
    });
    expect(result).toMatchObject({ ok: true, application: { id: 9 } });
    expect(serverApiFetch).toHaveBeenCalledWith("/loans/applications/9/respond", {
      method: "POST",
      body: {
        responses: [
          { information_request_id: 4, response_note: "Attached." },
          { information_request_id: 5, response_note: "New number 7000 1111." },
        ],
        document_ids: [6],
      },
    });
  });

  it("never sends the old single response_note shape", async () => {
    serverApiFetch.mockResolvedValue({ id: 9 });
    await respondToActionRequired({ applicationId: 9, responses: [{ information_request_id: 4, response_note: "x" }], documentIds: [] });
    const body = serverApiFetch.mock.calls[0][1].body;
    expect(body).not.toHaveProperty("response_note");
    expect(body.document_ids).toBeUndefined();
  });

  it("requires an answer for every request before calling the backend", async () => {
    expect(await respondToActionRequired({ applicationId: 9, responses: [], documentIds: [] })).toMatchObject({ ok: false });
    expect(
      await respondToActionRequired({ applicationId: 9, responses: [{ information_request_id: 4, response_note: "  " }], documentIds: [] }),
    ).toMatchObject({ ok: false });
    expect(serverApiFetch).not.toHaveBeenCalled();
  });
});

describe("submitRecommendation (officer)", () => {
  it("sends the recommendation and trimmed comments", async () => {
    serverApiFetch.mockResolvedValue({});
    expect(await submitRecommendation(8, "recommend_approval", "  All checks done. ")).toEqual({ ok: true, kind: "recommend_approval" });
    expect(serverApiFetch).toHaveBeenCalledWith("/loans/applications/8/recommend", {
      method: "POST",
      body: { recommendation: "recommend_approval", comments: "All checks done." },
    });
  });

  it("requires comments and a real recommendation type", async () => {
    expect(await submitRecommendation(8, "recommend_rejection", " ")).toMatchObject({ ok: false });
    expect(await submitRecommendation(8, "approve" as never, "x")).toMatchObject({ ok: false });
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("explains the backend's incomplete-checklist refusal for an approval", async () => {
    rejectWith(new ApiError(409, "Cannot recommend approval until every required checklist item is verified... Outstanding: ['valid_id']."));
    const result = await submitRecommendation(8, "recommend_approval", "x");
    expect(result).toMatchObject({ ok: false, error: /checklist isn't complete enough/ });
    // Raw backend item keys never reach the UI.
    expect(JSON.stringify(result)).not.toContain("valid_id");
  });
});

describe("updateChecklistItem (officer)", () => {
  it("patches one item and returns only the fields the UI renders", async () => {
    serverApiFetch.mockResolvedValue({
      application_id: 8,
      started: true,
      items: [{ item_type: "valid_id", label: "Valid ID checked", required: true, status: "verified", note: null, checked_by: 1, checked_by_name: "Olive", checked_at: null, customer_verification_id: 3 }],
      summary: { total: 1, required: 1, required_complete: 1, pending: 0, failed: 0, blocking_items: [], ready_for_approval_recommendation: true },
    });
    const result = await updateChecklistItem(8, "valid_id", "verified", "");
    expect(serverApiFetch).toHaveBeenCalledWith("/officer/applications/8/checklist/valid_id", {
      method: "PATCH",
      body: { status: "verified", note: undefined },
    });
    expect(result.ok && result.checklist.items[0]).not.toHaveProperty("checked_by");
    expect(result.ok && result.checklist.items[0]).not.toHaveProperty("customer_verification_id");
  });

  it("rejects a malformed item key or a problem without a note before calling the backend", async () => {
    expect(await updateChecklistItem(8, "../admin", "verified", "")).toMatchObject({ ok: false });
    expect(await updateChecklistItem(8, "valid_id", "failed", "")).toMatchObject({ ok: false });
    expect(serverApiFetch).not.toHaveBeenCalled();
  });
});
