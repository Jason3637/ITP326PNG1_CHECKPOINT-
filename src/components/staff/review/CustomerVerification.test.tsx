import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewChecklist, ReviewChecklistItem, ReviewCustomer } from "@/lib/types";

const updateChecklistItem = vi.fn();
const requestReverification = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/actions/checklist", () => ({ updateChecklistItem: (...a: unknown[]) => updateChecklistItem(...a) }));
vi.mock("@/lib/actions/customer-verification", () => ({
  requestReverification: (...a: unknown[]) => requestReverification(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { CustomerPanel } from "./CustomerPanel";
import { VerificationChecklist } from "./VerificationChecklist";
import { validateEvidence } from "@/lib/checklist";

// Customer-level verification: the identity checks record the DOB and which
// ID was checked; the "Verified customer" flag comes only from the
// verification record; DOB shows whenever it's on the customer record.

const TODAY = new Date(2026, 9, 3); // 3 Oct 2026
const draft = (over: Partial<{ dateOfBirth: string; idDocumentId: string; idExpiryDate: string }> = {}) => ({
  dateOfBirth: "",
  idDocumentId: "",
  idExpiryDate: "",
  ...over,
});

describe("validateEvidence", () => {
  it("needs a real, 18+ date of birth to verify age", () => {
    expect(validateEvidence("age_18_plus", "verified", draft(), TODAY)).toMatch(/date of birth/);
    expect(validateEvidence("age_18_plus", "verified", draft({ dateOfBirth: "2027-01-01" }), TODAY)).toMatch(/future/);
    expect(validateEvidence("age_18_plus", "verified", draft({ dateOfBirth: "2008-10-04" }), TODAY)).toMatch(/17 - under 18/);
    expect(validateEvidence("age_18_plus", "verified", draft({ dateOfBirth: "2008-10-03" }), TODAY)).toBeNull();
  });

  it("needs the ID document, and refuses an expired one", () => {
    expect(validateEvidence("valid_id", "verified", draft(), TODAY)).toMatch(/Choose which ID/);
    expect(validateEvidence("valid_id", "verified", draft({ idDocumentId: "41", idExpiryDate: "2026-10-02" }), TODAY)).toMatch(/expired/);
    expect(validateEvidence("valid_id", "verified", draft({ idDocumentId: "41" }), TODAY)).toBeNull();
  });

  it("asks for nothing when the check isn't being verified", () => {
    expect(validateEvidence("age_18_plus", "failed", draft(), TODAY)).toBeNull();
    expect(validateEvidence("referee", "verified", draft(), TODAY)).toBeNull();
  });
});

const customer = (over: Partial<ReviewCustomer> = {}): ReviewCustomer => ({
  id: 7,
  full_name: "Grace Waigani",
  email: "grace@example.com",
  phone_number: null,
  member_since: "2026-01-01T00:00:00Z",
  is_active: true,
  date_of_birth: null,
  verification: null,
  ...over,
});
const applicant = { residentialAddress: "Boroko", employerName: "BSP", employmentStatus: "employed" };

describe("CustomerPanel verification", () => {
  beforeEach(() => requestReverification.mockReset());

  it("shows the date of birth from the customer record even when not verified", () => {
    render(<CustomerPanel customer={customer({ date_of_birth: "1990-05-01" })} applicant={applicant} />);
    expect(screen.getByText(/May 1, 1990/)).toBeInTheDocument();
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
  });

  it("says where the date of birth comes from when there isn't one yet", () => {
    render(<CustomerPanel customer={customer()} applicant={applicant} />);
    expect(screen.getByText("Recorded at the Age 18+ check")).toBeInTheDocument();
  });

  it("shows Verified customer only from the verification record, with who and until when", () => {
    render(
      <CustomerPanel
        customer={customer({
          date_of_birth: "1990-05-01",
          verification: {
            verified_at: "2026-10-01T00:00:00Z",
            valid_until: "2027-10-01",
            date_of_birth: "1990-05-01",
            id_document_id: 41,
            verified_by_name: "Olive Officer",
          },
        })}
        applicant={applicant}
      />,
    );
    expect(screen.getByText("Verified customer")).toBeInTheDocument();
    expect(screen.getByText(/by Olive Officer/)).toBeInTheDocument();
    expect(screen.getByText(/Valid until/)).toBeInTheDocument();
  });

  it("lets the working officer request re-verification", async () => {
    const user = userEvent.setup();
    requestReverification.mockResolvedValue({ ok: true });
    render(
      <CustomerPanel
        customer={customer({
          verification: { verified_at: null, valid_until: "2027-10-01", date_of_birth: "1990-05-01", id_document_id: 41 },
        })}
        applicant={applicant}
        applicationId={8}
        canRequestReverification
      />,
    );
    await user.click(screen.getByRole("button", { name: "Request re-verification" }));
    await user.type(screen.getByRole("textbox"), "New ID card.");
    await user.click(screen.getByRole("button", { name: "Invalidate verification" }));
    expect(requestReverification).toHaveBeenCalledWith(8, "New ID card.");
    expect(refresh).toHaveBeenCalled();
  });

  it("doesn't offer re-verification to someone who can't act on the application", () => {
    render(
      <CustomerPanel
        customer={customer({
          verification: { verified_at: null, valid_until: "2027-10-01", date_of_birth: "1990-05-01", id_document_id: 41 },
        })}
        applicant={applicant}
        applicationId={8}
      />,
    );
    expect(screen.queryByRole("button", { name: "Request re-verification" })).not.toBeInTheDocument();
  });
});

function item(item_type: string, label: string, over: Partial<ReviewChecklistItem> = {}): ReviewChecklistItem {
  return {
    item_type, label, required: true, status: "pending", note: null, checked_by_name: null, checked_at: null,
    customer_verification_id: null, evidence: null, ...over,
  };
}
const list = (items: ReviewChecklistItem[]): ReviewChecklist => ({
  started: true,
  items,
  summary: { required: items.length, required_complete: 0, failed: 0, blocking_items: [], ready_for_approval_recommendation: false },
});
const row = (label: string) => screen.getByText(label).closest("li")!;

describe("Identity checks in the checklist", () => {
  beforeEach(() => updateChecklistItem.mockReset());

  it("Valid ID sends the chosen ID document and expiry", async () => {
    const user = userEvent.setup();
    updateChecklistItem.mockResolvedValue({ ok: true, checklist: list([item("valid_id", "Valid ID checked", { status: "verified" })]) });
    render(
      <VerificationChecklist
        applicationId={8}
        initial={list([item("valid_id", "Valid ID checked")])}
        editable
        lockedReason=""
        idDocuments={[{ id: 41, label: "Passport #41" }]}
      />,
    );
    const r = row("Valid ID checked");
    await user.click(within(r).getByRole("radio", { name: "Verified" }));
    await user.click(within(r).getByRole("button", { name: "Save" }));
    expect(within(r).getByRole("alert")).toHaveTextContent(/Choose which ID/);
    expect(updateChecklistItem).not.toHaveBeenCalled();

    await user.selectOptions(within(r).getByLabelText(/ID document checked/), "41");
    await user.type(within(r).getByLabelText(/ID expiry date/), "2030-01-31");
    await user.click(within(r).getByRole("button", { name: "Save" }));
    expect(updateChecklistItem).toHaveBeenCalledWith(8, "valid_id", "verified", "", {
      id_document_id: 41,
      id_expiry_date: "2030-01-31",
    });
  });

  it("shows what a verified identity check recorded, including carried-over ones", () => {
    render(
      <VerificationChecklist
        applicationId={8}
        initial={list([
          item("age_18_plus", "Age 18+ verified", {
            status: "verified", evidence: { date_of_birth: "1990-05-01" }, customer_verification_id: 3,
            note: "Carried over from customer verification #3 (verified 2026-09-01, valid until 2027-09-01).",
          }),
          item("valid_id", "Valid ID checked", {
            status: "verified", evidence: { id_document_id: 41, id_expiry_date: "2030-01-31" }, customer_verification_id: 3,
          }),
        ])}
        editable={false}
        lockedReason="Locked."
        idDocuments={[{ id: 41, label: "Passport #41" }]}
      />,
    );
    expect(screen.getByText(/Date of birth May 1, 1990/)).toBeInTheDocument();
    expect(screen.getByText(/Passport #41 · expires/)).toBeInTheDocument();
    expect(screen.getByText(/Carried over from customer verification #3/)).toBeInTheDocument();
  });
});
