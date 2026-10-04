import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const recordDisbursement = vi.fn();
const uploadDisbursementEvidence = vi.fn();
vi.mock("@/lib/actions/admin-disbursement", () => ({
  recordDisbursement: (...a: unknown[]) => recordDisbursement(...a),
  uploadDisbursementEvidence: (...a: unknown[]) => uploadDisbursementEvidence(...a),
}));

import { DisbursementForm } from "./DisbursementForm";

const props = {
  applicationId: 8,
  amount: 850,
  totalRepayable: 1148,
  requestedMethod: "bsp_mobile_banking" as const,
  maskedDestination: "•••• 2345",
};

async function fillAndReview(user: ReturnType<typeof userEvent.setup>, reference = "BSP-TXN-88213") {
  await user.type(screen.getByLabelText(/BSP transaction number/), reference);
  await user.click(screen.getByRole("button", { name: "Review disbursement" }));
}

describe("DisbursementForm", () => {
  beforeEach(() => {
    // Block bodies on purpose - see the dashboard test.
    replace.mockReset();
    recordDisbursement.mockReset();
    uploadDisbursementEvidence.mockReset();
  });

  it("starts on the customer's method and shows where a BSP payout goes, masked", () => {
    render(<DisbursementForm {...props} />);
    expect(screen.getByRole("radio", { name: /BSP Mobile Banking/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("•••• 2345")).toBeInTheDocument();
    expect(screen.getByText("K850")).toBeInTheDocument();
    expect(screen.getByLabelText(/BSP transaction number \(required\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/BSP receipt or screenshot \(optional\)/)).toBeInTheDocument();
  });

  it("asks cash payouts for the acknowledgement number and the signed acknowledgement", async () => {
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    await user.click(screen.getByRole("radio", { name: /Cash on Hand/ }));
    expect(screen.getByLabelText(/Cash acknowledgement number \(required\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Signed cash acknowledgement \(optional\)/)).toBeInTheDocument();
    expect(screen.queryByText("•••• 2345")).not.toBeInTheDocument();
  });

  it("collects only the designed fields - nothing for amount or term", () => {
    render(<DisbursementForm {...props} />);
    expect(screen.getAllByRole("textbox").map((el) => el.getAttribute("id") ?? el.tagName)).toHaveLength(2); // reference + note
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("won't go forward without a reference", async () => {
    render(<DisbursementForm {...props} />);
    expect(screen.getByRole("button", { name: "Review disbursement" })).toBeDisabled();
  });

  it("records once even on a double-click, and keeps the button locked while saving", async () => {
    let resolve!: (v: unknown) => void;
    recordDisbursement.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    await fillAndReview(user);

    const record = screen.getByRole("button", { name: "Record disbursement" });
    fireEvent.click(record);
    fireEvent.click(record);
    fireEvent.click(record);
    expect(recordDisbursement).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Recording disbursement/ })).toBeDisabled();

    resolve({ ok: true, loanId: 12, loanStatus: "active" });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/applications/8?disbursed=12", { scroll: true }));
    expect(recordDisbursement).toHaveBeenCalledWith(
      8,
      { method: "bsp_mobile_banking", reference: "BSP-TXN-88213", disbursedAt: "", note: "" },
      null,
    );
    // Never claims the loan is active itself - the page shows that from the backend.
    expect(document.body.textContent).not.toMatch(/Loan Active/i);
  });

  it("uploads the evidence first, and doesn't upload it again on a retry", async () => {
    uploadDisbursementEvidence.mockResolvedValue({ ok: true, documentId: 44 });
    recordDisbursement.mockResolvedValueOnce({ ok: false, error: "Couldn't record the disbursement. Try again." });
    recordDisbursement.mockResolvedValueOnce({ ok: true, loanId: 12, loanStatus: "active" });
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    await user.upload(screen.getByLabelText(/BSP receipt or screenshot/), new File(["%PDF"], "receipt.pdf", { type: "application/pdf" }));
    await fillAndReview(user);
    await user.click(screen.getByRole("button", { name: "Record disbursement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't record the disbursement");
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Review disbursement" }));
    await user.click(screen.getByRole("button", { name: "Record disbursement" }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(uploadDisbursementEvidence).toHaveBeenCalledTimes(1);
    expect(recordDisbursement).toHaveBeenLastCalledWith(8, expect.any(Object), 44);
  });

  it("stops if the evidence upload fails, without recording", async () => {
    uploadDisbursementEvidence.mockResolvedValue({ ok: false, error: "Unsupported file type. Upload a PDF, JPG, or PNG." });
    const user = userEvent.setup();
    render(<DisbursementForm {...props} />);
    await user.upload(screen.getByLabelText(/BSP receipt or screenshot/), new File(["%PDF"], "receipt.pdf", { type: "application/pdf" }));
    await fillAndReview(user);
    await user.click(screen.getByRole("button", { name: "Record disbursement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported file type");
    expect(recordDisbursement).not.toHaveBeenCalled();
  });
});
