import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportRepaymentForm } from "./ReportRepaymentForm";
import { uploadLoanDocument } from "@/lib/actions/documents";
import { reportRepayment } from "@/lib/actions/payments";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/actions/documents", () => ({
  uploadLoanDocument: vi.fn(),
}));

vi.mock("@/lib/actions/payments", () => ({
  reportRepayment: vi.fn(),
}));

const mockedUpload = vi.mocked(uploadLoanDocument);
const mockedReport = vi.mocked(reportRepayment);

const sampleTransaction = {
  id: 1,
  loan_id: 501,
  repayment_schedule_id: 9001,
  amount: 500,
  payment_method: "bsp_mobile_banking",
  payment_date: "2026-10-01",
  reference_number: null,
  status: "reported" as const,
  rejection_reason: null,
  reported_at: "2026-10-01T00:00:00Z",
  paid_at: null,
};

beforeEach(() => {
  mockedUpload.mockReset();
  mockedReport.mockReset();
});

// This form calls POST /api/payments/repay directly now (via
// reportRepayment()) - the balance genuinely doesn't move here (see
// app/services/payment_processing.py's module docstring: only an admin's
// later /verify call touches the ledger), so the copy on success is careful
// to say "reported"/"awaiting verification", never anything implying the
// balance already changed.
describe("ReportRepaymentForm", () => {
  it("shows validation errors and never calls reportRepayment when required fields are missing", async () => {
    const user = userEvent.setup();
    render(<ReportRepaymentForm loanId={501} repaymentScheduleId={9001} />);

    await user.click(screen.getByRole("button", { name: "Report repayment" }));

    expect(await screen.findByText("Enter the amount you paid.")).toBeInTheDocument();
    expect(mockedReport).not.toHaveBeenCalled();
  });

  it("reports the payment with the repayment_schedule_id, amount, date, method, and reference - no receipt required", async () => {
    mockedReport.mockResolvedValue({ ok: true, transaction: sampleTransaction });
    const user = userEvent.setup();
    render(<ReportRepaymentForm loanId={501} repaymentScheduleId={9001} />);

    await user.type(screen.getByLabelText("Amount paid (PGK)"), "500");
    await user.type(screen.getByLabelText("Reference number (if applicable)"), "TXN123");
    await user.click(screen.getByRole("button", { name: "Report repayment" }));

    await waitFor(() => expect(mockedReport).toHaveBeenCalledTimes(1));
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedReport).toHaveBeenCalledWith(
      expect.objectContaining({
        repayment_schedule_id: 9001,
        amount: 500,
        payment_method: "bsp_mobile_banking",
        reference_number: "TXN123",
      }),
    );
  });

  it("uploads the receipt first and passes its id as document_ids when a file is attached", async () => {
    mockedUpload.mockResolvedValue({
      ok: true,
      document: {
        id: 77,
        user_id: 1,
        loan_application_id: null,
        payment_transaction_id: null,
        document_type: "receipt",
        id_document_type: null,
        storage_path: "x",
        uploaded_at: "2026-01-01",
        is_current: true,
        superseded_by_id: null,
      },
    });
    mockedReport.mockResolvedValue({ ok: true, transaction: sampleTransaction });
    const user = userEvent.setup();
    render(<ReportRepaymentForm loanId={501} repaymentScheduleId={9001} />);

    await user.type(screen.getByLabelText("Amount paid (PGK)"), "500");
    const file = new File(["receipt-bytes"], "my-receipt.png", { type: "image/png" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await user.click(screen.getByRole("button", { name: "Report repayment" }));

    await waitFor(() => expect(mockedReport).toHaveBeenCalledTimes(1));
    expect(mockedUpload).toHaveBeenCalledTimes(1);
    expect(mockedReport).toHaveBeenCalledWith(expect.objectContaining({ document_ids: [77] }));
  });

  it("shows the exact 'Repayment Reported — Awaiting Verification' copy on success, and never implies the balance already changed", async () => {
    mockedReport.mockResolvedValue({ ok: true, transaction: sampleTransaction });
    const user = userEvent.setup();
    render(<ReportRepaymentForm loanId={501} repaymentScheduleId={9001} />);

    await user.type(screen.getByLabelText("Amount paid (PGK)"), "500");
    await user.click(screen.getByRole("button", { name: "Report repayment" }));

    expect(await screen.findByText("Repayment Reported — Awaiting Verification")).toBeInTheDocument();
    expect(screen.getByText(/hasn't changed your balance yet/)).toBeInTheDocument();
  });

  it("shows a customer-safe error and does not reach the confirmation screen when the report fails", async () => {
    mockedReport.mockResolvedValue({ ok: false, error: "Something went wrong. Try again." });
    const user = userEvent.setup();
    render(<ReportRepaymentForm loanId={501} repaymentScheduleId={9001} />);

    await user.type(screen.getByLabelText("Amount paid (PGK)"), "500");
    await user.click(screen.getByRole("button", { name: "Report repayment" }));

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    expect(screen.queryByText("Repayment Reported — Awaiting Verification")).not.toBeInTheDocument();
    // Entered data is preserved, not wiped out by the failure.
    expect(screen.getByLabelText("Amount paid (PGK)")).toHaveValue(500);
  });
});
