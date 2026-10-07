import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
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
import { RequestInformationButton } from "./RequestInformationButton";
import { RequestRounds } from "./workspace/RequestRounds";

// The element itself (a closed <dialog> isn't in the accessibility tree);
// while open it's also found by role and name - see the first test.
const dialog = () => document.querySelector("dialog")!;

describe("request-more-information dialog", () => {
  beforeEach(() => {
    requestMoreInformation.mockReset();
    replace.mockReset();
  });

  it("opens as a labelled modal from the panel or any trigger, starting on the first field", async () => {
    const user = userEvent.setup();
    render(
      <>
        <RequestInformationButton />
        <RequestInformationForm applicationId={16} id="request-information" />
      </>,
    );
    expect(dialog()).not.toHaveAttribute("open");
    // The panel in the action column carries the id it's given.
    expect(document.getElementById("request-information")).toHaveTextContent(/^Request more information/);

    await user.click(screen.getByRole("button", { name: "Request more information" }));
    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByRole("dialog", { name: "Request more information" })).toBe(dialog());
    expect(dialog()).toHaveAccessibleDescription(/Sending moves the application to Customer Action Required/);
    expect(within(dialog()).getByLabelText("Request type")).toHaveFocus();
  });

  it("announces validation errors and moves focus to the first field to fix", async () => {
    const user = userEvent.setup();
    render(<RequestInformationForm applicationId={16} />);
    await user.click(screen.getByRole("button", { name: "Start a request" }));
    await user.click(within(dialog()).getByRole("button", { name: "Send to customer" }));
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("Fix the highlighted fields first.");
    expect(within(dialog()).getByLabelText("Request type")).toHaveFocus();
    expect(within(dialog()).getByLabelText("Request type")).toHaveAttribute("aria-invalid", "true");
    expect(requestMoreInformation).not.toHaveBeenCalled();
  });

  it("keeps what was typed when closed with Escape, and discards it with Cancel", async () => {
    const user = userEvent.setup();
    render(<RequestInformationForm applicationId={16} />);
    await user.click(screen.getByRole("button", { name: "Start a request" }));
    await user.type(within(dialog()).getByLabelText(/What's needed and why/), "Payslip please.");

    act(() => {
      dialog().dispatchEvent(new Event("cancel", { cancelable: true })); // what Escape does
    });
    expect(dialog()).not.toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Start a request" }));
    expect(within(dialog()).getByLabelText(/What's needed and why/)).toHaveValue("Payslip please.");

    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Start a request" }));
    expect(within(dialog()).getByLabelText(/What's needed and why/)).toHaveValue("");
  });

  it("can't be closed while sending, then closes and goes to the confirmation", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    requestMoreInformation.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<RequestInformationForm applicationId={16} />);
    await user.click(screen.getByRole("button", { name: "Start a request" }));
    await user.selectOptions(within(dialog()).getByLabelText("Request type"), "other");
    await user.type(within(dialog()).getByLabelText(/What's needed and why/), "Please confirm.");
    await user.click(within(dialog()).getByRole("button", { name: "Send to customer" }));

    expect(within(dialog()).getByRole("button", { name: "Close" })).toBeDisabled();
    act(() => {
      dialog().dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(dialog()).toHaveAttribute("open");

    await act(async () => resolve({ ok: true, requestCount: 1 }));
    expect(dialog()).not.toHaveAttribute("open");
    expect(replace).toHaveBeenCalledWith("/staff/applications/16?requested=1", { scroll: true });
    // Same payload as before the dialog: the drafts as typed.
    expect(requestMoreInformation).toHaveBeenCalledWith(16, [
      { request_type: "other", reason: "Please confirm.", required_document_type: "", required_information: "", internal_note: "" },
    ]);
  });
});

const base: ReviewInformationRequest = {
  id: 1,
  request_type: "document_expired",
  reason: "Your payslip is from 2024.",
  required_document_type: "proof_of_income",
  required_information: null,
  internal_note: "HR says payslip is outdated.",
  status: "responded",
  requested_at: "2026-09-20T00:00:00Z",
  requested_by_name: "Olive Officer",
  cancelled_at: null,
  cancel_reason: null,
  response: { response_note: "Uploaded September payslip.", responded_at: "2026-09-21T00:00:00Z", field_changes: { monthly_income: { old: 900, new: 1200 } }, provided_document_ids: [55] },
};

describe("RequestRounds", () => {
  const rounds: ReviewInformationRequest[] = [
    base,
    { ...base, id: 2, request_type: "other", reason: "Confirm your address.", status: "cancelled", requested_at: "2026-09-22T00:00:00Z", cancelled_at: "2026-09-23T00:00:00Z", cancel_reason: "Verified by phone instead.", response: null },
    { ...base, id: 3, request_type: "employment_confirmation", reason: "Employer contact?", required_document_type: null, required_information: "Phone", status: "open", requested_at: "2026-09-25T00:00:00Z", response: null },
    { ...base, id: 4, request_type: "other", reason: "Bank statement?", required_document_type: null, status: "responded", requested_at: "2026-09-25T00:00:00Z", response: { ...base.response!, response_note: "Attached.", field_changes: null, provided_document_ids: [] } },
  ];

  it("lists every round newest first: the latest open, older ones folded but still in the page", () => {
    render(<RequestRounds requests={rounds} />);
    expect(screen.getByText("3 rounds")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").filter((li) => li.parentElement?.tagName === "OL");
    expect(items.map((li) => li.querySelector("span.font-semibold")?.textContent)).toEqual(["Round 3", "Round 2", "Round 1"]);
    // Latest open: both its requests and the summary in words.
    expect(within(items[0]).queryByRole("group")).toBeNull();
    expect(items[0]).toHaveTextContent("1 waiting on customer");
    expect(items[0]).toHaveTextContent("1 answered");
    expect(within(items[0]).getByText("Employer contact?")).toBeVisible();
    // Older rounds: in collapsed disclosures, nothing dropped.
    for (const li of items.slice(1)) expect(li.querySelector("details")).not.toHaveAttribute("open");
    expect(within(items[1]).getByText(/Verified by phone instead\./)).toBeInTheDocument();
    expect(within(items[2]).getByText("Uploaded September payslip.")).toBeInTheDocument();
    expect(within(items[2]).getByText("HR says payslip is outdated.")).toBeInTheDocument();
    expect(within(items[2]).getByText("Documents the customer provided in this response")).toBeInTheDocument();
    expect(within(items[2]).getByText(/Monthly income/)).toBeInTheDocument();
  });

  it("says when nothing has been requested", () => {
    render(<RequestRounds requests={[]} />);
    expect(screen.getByText("No information has been requested on this application.")).toBeInTheDocument();
  });
});
