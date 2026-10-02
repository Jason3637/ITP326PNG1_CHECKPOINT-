import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewInformationRequest } from "@/lib/types";

const requestMoreInformation = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/actions/information-requests", () => ({
  requestMoreInformation: (...a: unknown[]) => requestMoreInformation(...a),
}));
vi.mock("@/lib/actions/staff-documents", () => ({ getStaffDocumentUrl: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { RequestInformationForm } from "./RequestInformationForm";
import { RequestHistoryPanel } from "./RequestHistoryPanel";

describe("RequestInformationForm", () => {
  beforeEach(() => {
    requestMoreInformation.mockReset();
    replace.mockReset();
  });

  async function openForm() {
    const user = userEvent.setup();
    render(<RequestInformationForm applicationId={16} />);
    await user.click(screen.getByRole("button", { name: "Start a request" }));
    return user;
  }

  it("collects type, reason, required document/information and an internal note", async () => {
    const user = await openForm();
    requestMoreInformation.mockResolvedValue({ ok: true, requestCount: 1 });

    await user.selectOptions(screen.getByLabelText("Request type"), "document_expired");
    await user.type(screen.getByLabelText(/What's needed and why/), "Your payslip is from 2024.");
    await user.selectOptions(screen.getByLabelText(/Document to upload/), "proof_of_income");
    await user.type(screen.getByLabelText(/Information to provide/), "Pay period dates");
    await user.type(screen.getByLabelText(/Internal note/), "Checked with HR - old payslip.");
    await user.click(screen.getByRole("button", { name: "Send to customer" }));

    expect(requestMoreInformation).toHaveBeenCalledWith(16, [
      {
        request_type: "document_expired",
        reason: "Your payslip is from 2024.",
        required_document_type: "proof_of_income",
        required_information: "Pay period dates",
        internal_note: "Checked with HR - old payslip.",
      },
    ]);
    expect(replace).toHaveBeenCalledWith("/staff/applications/16?requested=1", { scroll: true });
  });

  it("validates every item before sending anything", async () => {
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: /Add another request/ }));
    expect(screen.getAllByRole("group")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Send to customer" }));
    expect(screen.getAllByText("Choose what kind of request this is.")).toHaveLength(2);
    expect(requestMoreInformation).not.toHaveBeenCalled();
  });

  it("removes an item", async () => {
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: /Add another request/ }));
    await user.click(within(screen.getAllByRole("group")[1]).getByRole("button", { name: /Remove/ }));
    expect(screen.getAllByRole("group")).toHaveLength(1);
  });

  it("shows a backend refusal and stays on the form", async () => {
    const user = await openForm();
    requestMoreInformation.mockResolvedValue({ ok: false, error: "Only the assigned officer or an administrator can request information." });
    await user.selectOptions(screen.getByLabelText("Request type"), "other");
    await user.type(screen.getByLabelText(/What's needed and why/), "Please confirm.");
    await user.click(screen.getByRole("button", { name: "Send to customer" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/assigned officer/);
    expect(replace).not.toHaveBeenCalled();
  });
});

function req(overrides: Partial<ReviewInformationRequest>): ReviewInformationRequest {
  return {
    id: 1,
    request_type: "document_expired",
    reason: "Your payslip is from 2024.",
    required_document_type: "proof_of_income",
    required_information: null,
    internal_note: null,
    status: "responded",
    requested_at: "2026-09-20T00:00:00+00:00",
    requested_by_name: "Olive Officer",
    cancelled_at: null,
    cancel_reason: null,
    response: null,
    ...overrides,
  };
}

describe("RequestHistoryPanel", () => {
  it("shows every round and every response, not just the latest", () => {
    const changes = { monthly_income: { old: 900, new: 1200 } };
    render(
      <RequestHistoryPanel
        requests={[
          req({
            id: 1,
            internal_note: "HR says payslip is outdated.",
            response: { response_note: "Uploaded September payslip.", responded_at: "2026-09-21T00:00:00+00:00", field_changes: changes, provided_document_ids: [41] },
          }),
          req({
            id: 2,
            request_type: "information_mismatch",
            reason: "Income doesn't match the payslip.",
            required_document_type: null,
            // The backend repeats the submission's document ids on every response in the round.
            response: { response_note: "Updated my income.", responded_at: "2026-09-21T00:00:00+00:00", field_changes: changes, provided_document_ids: [41] },
          }),
          req({ id: 3, request_type: "referee_unreachable", reason: "We couldn't reach Maria.", required_document_type: null, status: "open", requested_at: "2026-09-25T00:00:00+00:00" }),
        ]}
      />,
    );
    expect(screen.getByText("2 rounds")).toBeInTheDocument();
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
    expect(screen.getByText(/Round 2/)).toBeInTheDocument();
    expect(screen.getByText("Uploaded September payslip.")).toBeInTheDocument();
    expect(screen.getByText("Updated my income.")).toBeInTheDocument();
    expect(screen.getByText("Waiting on customer")).toBeInTheDocument();
    expect(screen.getByText("HR says payslip is outdated.")).toBeInTheDocument();
    expect(screen.getByText("Documents the customer provided in this response")).toBeInTheDocument();
    expect(screen.getAllByText("Document #41")).toHaveLength(1);
    // Same field changes on both responses of round 1 - shown once.
    expect(screen.getAllByText(/Monthly income:/)).toHaveLength(1);
  });

  it("shows cancelled requests with their reason", () => {
    render(<RequestHistoryPanel requests={[req({ status: "cancelled", cancelled_at: "2026-09-22T00:00:00+00:00", cancel_reason: "Verified by phone instead." })]} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText(/Verified by phone instead\./)).toBeInTheDocument();
  });

  it("says when nothing has been requested", () => {
    render(<RequestHistoryPanel requests={[]} />);
    expect(screen.getByText("No information has been requested on this application.")).toBeInTheDocument();
  });
});
