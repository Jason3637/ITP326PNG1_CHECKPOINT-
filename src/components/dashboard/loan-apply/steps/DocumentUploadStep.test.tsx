import type { ComponentProps } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentUploadStep } from "./DocumentUploadStep";
import { uploadLoanDocument } from "@/lib/actions/documents";
import type { WizardData } from "../LoanApplyWizard";
import type { Document } from "@/lib/types";

vi.mock("@/lib/actions/documents", () => ({
  uploadLoanDocument: vi.fn(),
}));

const mockedUpload = vi.mocked(uploadLoanDocument);

function baseData(overrides: Partial<WizardData> = {}): WizardData {
  return {
    amount: "500",
    category: "business",
    otherDescription: "",
    monthlyIncome: "1000",
    employmentStatus: "employed",
    existingMonthlyDebt: "",
    disbursementMethod: "cash_on_hand",
    bspMobileNumber: "",
    idType: "",
    idFile: null,
    idSource: "",
    idDocumentId: null,
    refereeFullName: "Jane Referee",
    refereeRelationship: "Sibling",
    refereeMobile: "+675 7000 1111",
    refereeEmployer: "",
    incomeFile: null,
    incomeSource: "",
    incomeDocumentId: null,
    termsAccepted: false,
    ...overrides,
  };
}

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 1,
    user_id: 1,
    loan_application_id: null,
    payment_transaction_id: null,
    document_type: "id_verification",
    storage_path: "users/1/id_verification/x.png",
    uploaded_at: "2026-09-01T00:00:00Z",
    is_current: true,
    superseded_by_id: null,
    ...overrides,
  };
}

function renderStep(props: Partial<ComponentProps<typeof DocumentUploadStep>> = {}) {
  const onChange = vi.fn();
  const onNext = vi.fn();
  const onBack = vi.fn();
  const utils = render(
    <DocumentUploadStep
      data={baseData()}
      amount={500}
      onChange={onChange}
      onBack={onBack}
      onNext={onNext}
      {...props}
    />,
  );
  return { ...utils, onChange, onNext, onBack };
}

describe("DocumentUploadStep — proof of income threshold (item 4)", () => {
  beforeEach(() => mockedUpload.mockReset());

  it("does not require proof of income below the K1,000 threshold", async () => {
    const user = userEvent.setup();
    const { onNext } = renderStep({ amount: 500, data: baseData({ amount: "500", idType: "national_id", idFile: new File(["x"], "id.png", { type: "image/png" }) }) });

    expect(screen.getByText("Proof of income")).toBeInTheDocument();
    expect(screen.getByText("(optional)")).toBeInTheDocument();

    mockedUpload.mockResolvedValue({ ok: true, document: makeDocument({ document_type: "id_verification" }) });
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
  });

  it("requires proof of income at or above the K1,000 threshold and blocks Continue without it", async () => {
    const user = userEvent.setup();
    const { onNext } = renderStep({
      amount: 1000,
      data: baseData({ amount: "1000", idType: "national_id", idFile: new File(["x"], "id.png", { type: "image/png" }) }),
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Proof of income is required for amounts of K1,000 or more.")).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("enforces the requirement fresh regardless of an existing (possibly unrelated) income document — reuse must be an explicit choice, not automatic", async () => {
    const user = userEvent.setup();
    const existingIncomeDocument = makeDocument({ id: 9, document_type: "proof_of_income", uploaded_at: "2026-01-01T00:00:00Z" });
    const { onNext } = renderStep({
      amount: 5000,
      data: baseData({ amount: "5000", idType: "national_id", idFile: new File(["x"], "id.png", { type: "image/png" }) }),
      existingIncomeDocument,
    });

    // Requirement is visible and NOT silently satisfied just because a
    // document exists — the customer must explicitly confirm it first.
    expect(screen.getByText(/Still current\?/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onNext).not.toHaveBeenCalled();

    // Explicitly confirming reuse satisfies the requirement without an upload.
    await user.click(screen.getByRole("button", { name: "Yes, still current" }));
    mockedUpload.mockResolvedValue({ ok: true, document: makeDocument() });
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    // No upload call was made for the reused income document — the only
    // document in play here was the ID, and even that was uploaded fresh
    // (income was never a file at all in this scenario).
    expect(mockedUpload).toHaveBeenCalledTimes(1);
  });

  it("a prior (lower-amount) application's lack of an income requirement never carries over to a higher new amount", async () => {
    // Simulates the returning-customer scenario: nothing in `data` or props
    // here represents "the old application didn't need this" — the
    // requirement is purely a function of the *current* `amount` prop.
    const user = userEvent.setup();
    const { onNext } = renderStep({
      amount: 2500,
      data: baseData({ amount: "2500", idType: "national_id", idFile: new File(["x"], "id.png", { type: "image/png" }) }),
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Proof of income is required for amounts of K1,000 or more.")).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe("DocumentUploadStep — existing document reuse (item 3)", () => {
  beforeEach(() => mockedUpload.mockReset());

  it("offers reuse for an existing ID document instead of forcing a fresh upload, and only on explicit confirmation", async () => {
    const user = userEvent.setup();
    const existingIdDocument = makeDocument({ uploaded_at: "2026-06-15T00:00:00Z" });
    const { onChange, onNext } = renderStep({ existingIdDocument });

    expect(screen.getByText(/an ID document on file from/)).toBeInTheDocument();
    // No ID type/file inputs shown until the customer declines reuse.
    expect(screen.queryByLabelText("ID type")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, still current" }));
    mockedUpload.mockResolvedValue({ ok: true, document: makeDocument() });
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith("idSource", "existing");
    // Reusing never calls the upload endpoint for the ID document.
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("falls back to a normal upload when the customer says the existing ID is no longer current", async () => {
    const user = userEvent.setup();
    const existingIdDocument = makeDocument();
    renderStep({ existingIdDocument });

    await user.click(screen.getByRole("button", { name: "No, upload a new one" }));

    expect(screen.getByLabelText("ID type")).toBeInTheDocument();
    expect(screen.getByText(/ID document file/)).toBeInTheDocument();
  });
});
