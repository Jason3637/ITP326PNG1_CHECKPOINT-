import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const recordDisbursement = vi.fn();
const uploadDisbursementEvidence = vi.fn();
vi.mock("@/lib/actions/admin-disbursement", () => ({
  recordDisbursement: (...a: unknown[]) => recordDisbursement(...a),
  uploadDisbursementEvidence: (...a: unknown[]) => uploadDisbursementEvidence(...a),
}));

import { DisbursementForm, RecordDisbursementButton } from "./DisbursementForm";

const props = {
  applicationId: 8,
  customerName: "Simon Wari",
  amount: 850,
  totalRepayable: 1148,
  requestedMethod: "bsp_mobile_banking" as const,
  maskedDestination: "•••• 2345",
};

type User = ReturnType<typeof userEvent.setup>;

const dialog = () => screen.getByRole("dialog");

async function openForm(user: User) {
  await user.click(screen.getByRole("button", { name: "Record disbursement" }));
  return dialog();
}

async function fillAndContinue(user: User, reference = "BSP-TXN-88213") {
  await user.type(within(dialog()).getByLabelText(/BSP transaction number/), reference);
  await user.click(within(dialog()).getByRole("button", { name: "Continue" }));
}

const receipt = () => new File(["%PDF"], "receipt.pdf", { type: "application/pdf" });

describe("DisbursementForm", () => {
  beforeEach(() => {
    // Block bodies on purpose - see the dashboard test.
    replace.mockReset();
    recordDisbursement.mockReset();
    uploadDisbursementEvidence.mockReset();
  });

  it("keeps the payout out of the page: a summary and a button, the form in a dialog", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); // closed
    const summary = screen.getByRole("heading", { name: "Disbursement" }).closest("div.rounded-xl") as HTMLElement;
    expect(within(summary).getByText("K850")).toBeInTheDocument();
    expect(within(summary).queryByRole("textbox")).not.toBeInTheDocument(); // no fields on the page itself
    const form = await openForm(user);
    expect(form).toHaveAccessibleName("Record disbursement");
  });

  it("starts on the customer's method and shows where a BSP payout goes, masked", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    expect(within(form).getByRole("radio", { name: /BSP Mobile Banking/ })).toBeChecked();
    expect(within(form).getByText("•••• 2345")).toBeInTheDocument();
    expect(within(form).getByText("K850")).toBeInTheDocument();
    expect(within(form).getByText("K1,148")).toBeInTheDocument();
    expect(within(form).getByLabelText(/BSP transaction number \(required\)/)).toBeInTheDocument();
    expect(within(form).getByLabelText(/BSP receipt or screenshot \(required\)/)).toBeInTheDocument();
  });

  it("won't record a BSP payout without its receipt; cash doesn't need one", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    await user.type(within(form).getByLabelText(/BSP transaction number/), "BSP-TXN-1");
    expect(within(form).getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.upload(within(form).getByLabelText(/BSP receipt or screenshot/), receipt());
    expect(within(form).getByRole("button", { name: "Continue" })).toBeEnabled();

    await user.click(within(form).getByRole("radio", { name: /Cash on Hand/ }));
    await user.type(within(form).getByLabelText(/Cash acknowledgement number/), "CASH-1");
    expect(within(form).getByLabelText(/Signed cash acknowledgement \(optional\)/)).toBeInTheDocument();
  });

  it("asks cash payouts for the acknowledgement number and the signed acknowledgement", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    await user.click(within(form).getByRole("radio", { name: /Cash on Hand/ }));
    expect(within(form).getByLabelText(/Cash acknowledgement number \(required\)/)).toBeInTheDocument();
    expect(within(form).getByLabelText(/Signed cash acknowledgement \(optional\)/)).toBeInTheDocument();
    expect(screen.queryByText("•••• 2345")).not.toBeInTheDocument();
  });

  it("collects only the designed fields - nothing for amount or term", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    expect(within(form).getAllByRole("textbox")).toHaveLength(2); // reference + note
    expect(within(form).queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("won't go forward without a reference", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    expect(within(form).getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("shows exactly what will be recorded before anything is sent", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    await user.upload(within(form).getByLabelText(/BSP receipt or screenshot/), receipt());
    await user.type(within(form).getByLabelText(/When the money moved/), "2026-10-06T14:30");
    await user.type(within(form).getByLabelText(/Note/), "Paid at Waigani branch.");
    await fillAndContinue(user);

    expect(form).toHaveAccessibleName("Review disbursement");
    const rows = Object.fromEntries(
      within(form).getAllByRole("term").map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
    );
    expect(rows).toEqual({
      Customer: "Simon Wari",
      "Amount paid out": "K850",
      "Customer repays": "K1,148",
      Method: "BSP Mobile Banking",
      "Paid to": "•••• 2345",
      "BSP transaction number": "BSP-TXN-88213",
      "Money moved": "Oct 6, 2026, 2:30 PM, Port Moresby time",
      Evidence: "receipt.pdf",
      Note: "Paid at Waigani branch.",
    });
    expect(recordDisbursement).not.toHaveBeenCalled();
    expect(uploadDisbursementEvidence).not.toHaveBeenCalled();

    // Back returns to the fields exactly as left.
    await user.click(within(form).getByRole("button", { name: "Back" }));
    expect(within(form).getByLabelText(/BSP transaction number/)).toHaveValue("BSP-TXN-88213");
    expect(within(form).getByLabelText(/Note/)).toHaveValue("Paid at Waigani branch.");
  });

  it("records once even on a double-click, and keeps the button locked while saving", async () => {
    let resolve!: (v: unknown) => void;
    uploadDisbursementEvidence.mockResolvedValue({ ok: true, documentId: 44 });
    recordDisbursement.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    await user.upload(within(form).getByLabelText(/BSP receipt or screenshot/), receipt());
    await fillAndContinue(user);

    const confirm = within(form).getByRole("button", { name: "Confirm disbursement" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(recordDisbursement).toHaveBeenCalledTimes(1));
    expect(uploadDisbursementEvidence).toHaveBeenCalledTimes(1);
    expect(within(form).getByRole("button", { name: /Recording disbursement/ })).toBeDisabled();

    resolve({ ok: true, loanId: 12, loanStatus: "active" });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/applications/8?disbursed=12", { scroll: true }));
    expect(recordDisbursement).toHaveBeenCalledWith(
      8,
      { method: "bsp_mobile_banking", reference: "BSP-TXN-88213", disbursedAt: "", note: "" },
      44,
    );
    // Never claims the loan is active itself - the page shows that from the backend.
    expect(document.body.textContent).not.toMatch(/Loan Active/i);
  });

  it("can't be closed while the disbursement is being recorded", async () => {
    uploadDisbursementEvidence.mockResolvedValue({ ok: true, documentId: 44 });
    recordDisbursement.mockImplementation(() => new Promise(() => {})); // never answers
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    await user.upload(within(form).getByLabelText(/BSP receipt or screenshot/), receipt());
    await fillAndContinue(user);
    await user.click(within(form).getByRole("button", { name: "Confirm disbursement" }));
    await vi.waitFor(() => expect(recordDisbursement).toHaveBeenCalled());

    expect(within(form).getByRole("button", { name: "Close" })).toBeDisabled();
    expect(within(form).getByRole("button", { name: "Back" })).toBeDisabled();
    fireEvent(form, new Event("cancel", { cancelable: true })); // Escape
    expect(form).toHaveAttribute("open");
  });

  it("Cancel closes without sending and keeps what was typed for next time", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    let form = await openForm(user);
    await user.type(within(form).getByLabelText(/BSP transaction number/), "BSP-TXN-7");
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(recordDisbursement).not.toHaveBeenCalled();

    form = await openForm(user);
    expect(within(form).getByLabelText(/BSP transaction number/)).toHaveValue("BSP-TXN-7");
  });

  it("opens from the page's other Record disbursement button", async () => {
    render(
      <>
        <RecordDisbursementButton />
        <DisbursementForm {...props} />
      </>,
    );
    act(() => screen.getAllByRole("button", { name: "Record disbursement" })[0].click());
    expect(dialog()).toHaveAccessibleName("Record disbursement");
  });

  it("uploads the evidence first, and doesn't upload it again on a retry", async () => {
    uploadDisbursementEvidence.mockResolvedValue({ ok: true, documentId: 44 });
    recordDisbursement.mockResolvedValueOnce({ ok: false, error: "Couldn't record the disbursement. Try again." });
    recordDisbursement.mockResolvedValueOnce({ ok: true, loanId: 12, loanStatus: "active" });
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    await user.upload(within(form).getByLabelText(/BSP receipt or screenshot/), receipt());
    await fillAndContinue(user);
    await user.click(within(form).getByRole("button", { name: "Confirm disbursement" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Couldn't record the disbursement");
    expect(replace).not.toHaveBeenCalled();

    await user.click(within(form).getByRole("button", { name: "Continue" }));
    await user.click(within(form).getByRole("button", { name: "Confirm disbursement" }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(uploadDisbursementEvidence).toHaveBeenCalledTimes(1);
    expect(recordDisbursement).toHaveBeenLastCalledWith(8, expect.any(Object), 44);
  });

  it("stops if the evidence upload fails, without recording", async () => {
    uploadDisbursementEvidence.mockResolvedValue({ ok: false, error: "Unsupported file type. Upload a PDF, JPG, or PNG." });
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    const form = await openForm(user);
    await user.upload(within(form).getByLabelText(/BSP receipt or screenshot/), receipt());
    await fillAndContinue(user);
    await user.click(within(form).getByRole("button", { name: "Confirm disbursement" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Unsupported file type");
    expect(recordDisbursement).not.toHaveBeenCalled();
  });
});
