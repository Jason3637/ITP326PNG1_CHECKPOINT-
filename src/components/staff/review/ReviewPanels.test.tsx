import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The view button's server action imports server-only code.
vi.mock("@/lib/actions/staff-documents", () => ({ getStaffDocumentUrl: vi.fn() }));

import { CreditAdvisoryPanel } from "./CreditAdvisoryPanel";
import { DocumentsPanel } from "./DocumentsPanel";
import { ApplicationPanel } from "./ApplicationPanel";
import { toCreditAdvisory } from "@/lib/application-review";
import type { ReviewApplication, ReviewChecklistItem, ReviewCustomer, ReviewDocument } from "@/lib/types";

const application: ReviewApplication = {
  id: 12,
  amount_requested: 700,
  purpose_category: "school_fees",
  purpose: "Term 4 fees",
  confirmed_full_name: "James Koi",
  confirmed_email: "james@example.com",
  confirmed_phone_number: "+675 7000 0000",
  prime_category: "PRIME 2",
  pricing: { category: "PRIME 2", amount: 700, interest_amount: 140, interest_rate: 0.4, total_repayable: 840, term_days: 14 },
  monthly_income: 1200,
  employment_status: "employed",
  existing_monthly_debt: null,
  residential_address: null,
  employer_name: null,
  disbursement_method_requested: "bsp_mobile_banking",
  disbursement_account_reference: "70001111",
  referees: [{ id: 1, full_name: "Maria Kaupa", relationship: "sibling", mobile_number: "+675 7123 4567" }],
  status: "officer_review",
  submitted_at: "2026-09-28T01:00:00Z",
};

const customer: ReviewCustomer = {
  id: 7,
  full_name: "James Koi",
  email: "james@example.com",
  phone_number: "+675 7999 9999",
  member_since: "2026-01-01T00:00:00Z",
  is_active: true,
  date_of_birth: null,
  verification: null,
};

describe("CreditAdvisoryPanel", () => {
  const raw = {
    algorithm: "interim-v2",
    // Older results store superseded developer wording, frozen at evaluation time.
    disclaimer: "Interim underwriting model - thresholds are still engineering guesses.",
    evaluated_at: "2026-09-28T01:00:00Z",
    score: 35,
    eligible: false,
    insufficient_data: false,
    max_eligible_amount: 350,
    reasons: ["Member account is less than 30 days old - limited track record."],
    recommendation: "decline",
    criteria_checked: ["minimum_income", "debt_to_income_ratio"],
  };

  it("labels itself advisory and never shows a score, verdict or cap", () => {
    render(
      <CreditAdvisoryPanel
        advisory={toCreditAdvisory(raw)}
        label="Advisory - not a decision input"
        application={application}
      />,
    );
    expect(screen.getByText("Advisory - not a decision input")).toBeInTheDocument();
    expect(screen.getByText(/does not replace the judgment of the Loan Officer or Administrator/)).toBeInTheDocument();
    expect(screen.queryByText(/\b35\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/decline|eligible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/K350/)).not.toBeInTheDocument();
  });

  it("shows one disclaimer, never the stored copy or the model name", () => {
    const { container } = render(
      <CreditAdvisoryPanel advisory={toCreditAdvisory(raw)} label="Advisory - not a decision input" application={application} />,
    );
    const text = container.textContent ?? "";
    expect(text.match(/Advisory assessment only\./g)).toHaveLength(1);
    expect(text).not.toMatch(/never approves/); // the old, second wording
    expect(text).not.toMatch(/engineering guesses|Interim underwriting/);
    expect(text).not.toMatch(/interim-v2|by model/);
    expect(text).toMatch(/Produced .*2026/);
  });

  it("explains what each check looked at, and the inputs used", () => {
    render(<CreditAdvisoryPanel advisory={toCreditAdvisory(raw)} label="Advisory" application={application} />);
    expect(screen.getByText("Member account is less than 30 days old - limited track record.")).toBeInTheDocument();
    expect(screen.getByText(/Self-reported monthly income on this application/)).toBeInTheDocument();
    expect(screen.getByText(/Income K1,200/)).toBeInTheDocument();
    expect(screen.getByText(/Existing debt not reported/)).toBeInTheDocument();
  });

  it("says so when there are no notes", () => {
    render(<CreditAdvisoryPanel advisory={null} label="Advisory" application={application} />);
    expect(screen.getByText("No credit notes were produced for this application.")).toBeInTheDocument();
  });
});

describe("ApplicationPanel", () => {
  it("shows the backend's pricing figures as-is", () => {
    render(<ApplicationPanel application={application} customer={customer} />);
    expect(screen.getByText("K140")).toBeInTheDocument();
    expect(screen.getByText("K840")).toBeInTheDocument();
    expect(screen.getByText("14 days")).toBeInTheDocument();
    expect(screen.getByText("BSP Mobile Banking")).toBeInTheDocument();
  });

  it("never estimates pricing when the backend didn't return it", () => {
    render(<ApplicationPanel application={{ ...application, pricing: null }} customer={customer} />);
    expect(screen.getByText(/didn't return pricing/)).toBeInTheDocument();
    expect(screen.queryByText("Total repayment")).not.toBeInTheDocument();
  });

  it("flags confirmed contact details that differ from the profile", () => {
    render(<ApplicationPanel application={application} customer={customer} />);
    expect(screen.getByText("Differs from the customer's profile: mobile")).toBeInTheDocument();
  });
});

const requestBase = {
  request_type: "document_expired" as const,
  required_information: null,
  internal_note: null,
  requested_by_name: "Olive Officer",
  cancelled_at: null,
  cancel_reason: null,
};

describe("DocumentsPanel", () => {
  const idDoc: ReviewDocument = {
    id: 31,
    loan_application_id: null,
    document_type: "id_verification",
    id_document_type: "national_id",
    uploaded_at: "2026-09-27T00:00:00Z",
    is_current: true,
    superseded_by_id: null,
    linked_to_this_application: false,
  };
  const items = (overrides: Partial<Record<string, Partial<ReviewChecklistItem>>> = {}): ReviewChecklistItem[] =>
    [
      { item_type: "valid_id", label: "Valid ID checked", required: true, status: "verified" as const },
      { item_type: "referee", label: "Referee checked", required: true, status: "pending" as const },
      { item_type: "proof_of_income", label: "Proof of income checked", required: false, status: "pending" as const },
    ].map((i) => ({ note: null, checked_by_name: null, checked_at: null, customer_verification_id: null, evidence: null, ...i, ...overrides[i.item_type] }));

  it("shows each document's check status and marks the ID used for verification", () => {
    render(
      <DocumentsPanel
        documents={[idDoc]}
        earlierVersions={[]}
        referees={application.referees}
        checklist={{ started: true, items: items() }}
        informationRequests={[]}
        verifiedIdDocumentId={31}
      />,
    );
    expect(screen.getByText("Valid ID checked: Verified")).toBeInTheDocument();
    expect(screen.getByText("Referee checked: Not checked yet")).toBeInTheDocument();
    expect(screen.getByText("Used for the customer's current verification")).toBeInTheDocument();
    expect(screen.getByText("Not required for this amount")).toBeInTheDocument();
    expect(screen.getByText("Maria Kaupa")).toBeInTheDocument();
  });

  it("uses the backend's rule for whether proof of income is required", () => {
    render(
      <DocumentsPanel
        documents={[]}
        earlierVersions={[]}
        referees={[]}
        checklist={{ started: true, items: items({ proof_of_income: { required: true } }) }}
        informationRequests={[]}
        verifiedIdDocumentId={null}
      />,
    );
    expect(screen.getByText("Required, but none uploaded.")).toBeInTheDocument();
    expect(screen.getByText("No ID document on file.")).toBeInTheDocument();
  });

  it("explains that checks start at claim time", () => {
    render(
      <DocumentsPanel
        documents={[idDoc]}
        earlierVersions={null}
        referees={[]}
        checklist={{ started: false, items: [] }}
        informationRequests={[]}
        verifiedIdDocumentId={null}
      />,
    );
    expect(screen.getAllByText("Checks start when claimed").length).toBeGreaterThan(0);
    expect(screen.getByText(/Couldn't load earlier versions/)).toBeInTheDocument();
  });

  it("ties replaced documents to the information request that asked for them", () => {
    const oldPayslip: ReviewDocument = {
      ...idDoc,
      id: 40,
      loan_application_id: 12,
      document_type: "proof_of_income",
      id_document_type: null,
      is_current: false,
      superseded_by_id: 41,
    };
    const newPayslip: ReviewDocument = { ...oldPayslip, id: 41, is_current: true, superseded_by_id: null };
    render(
      <DocumentsPanel
        documents={[newPayslip]}
        earlierVersions={[oldPayslip]}
        referees={[]}
        checklist={{ started: true, items: items({ proof_of_income: { required: true } }) }}
        informationRequests={[
          {
            ...requestBase,
            id: 5,
            reason: "Your payslip is from 2024 - please upload a current one.",
            required_document_type: "proof_of_income",
            status: "responded",
            requested_at: "2026-09-20T00:00:00Z",
            response: {
              response_note: "Uploaded.",
              responded_at: "2026-09-21T00:00:00Z",
              field_changes: null,
              provided_document_ids: [41],
            },
          },
          {
            ...requestBase,
            id: 6,
            request_type: "document_unclear",
            reason: "Please upload a clearer ID.",
            required_document_type: "id_verification",
            status: "open",
            requested_at: "2026-09-22T00:00:00Z",
            response: null,
          },
        ]}
        verifiedIdDocumentId={null}
      />,
    );
    expect(
      screen.getByText(/Provided in response to an information request.*Your payslip is from 2024/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Replaced by #41 .* - in response to an information request/)).toBeInTheDocument();
    // Only the ID section is still waiting - the payslip request was answered.
    expect(screen.getAllByText(/waiting on their upload/)).toHaveLength(1);
  });
});
