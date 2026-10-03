import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The view button's server action imports server-only code.
vi.mock("@/lib/actions/staff-documents", () => ({ getStaffDocumentUrl: vi.fn() }));

import { CustomerPanel } from "./CustomerPanel";
import { ApplicationPanel } from "./ApplicationPanel";
import { DocumentsPanel } from "./DocumentsPanel";
import type { ReviewApplication, ReviewCustomer, ReviewDocument } from "@/lib/types";

// Regression: residence, employer, ID type and interest rate used to show as
// "Not collected by the system" on the Application Review screen.

const customer: ReviewCustomer = {
  id: 7,
  full_name: "Kila Third",
  email: "kila@example.com",
  phone_number: "+675 7000 0003",
  member_since: "2026-01-01T00:00:00Z",
  is_active: true,
  verification: null,
};

const application: ReviewApplication = {
  id: 3,
  amount_requested: 750,
  purpose_category: "school_fees",
  purpose: "Term 4 fees",
  confirmed_full_name: "Kila Third",
  confirmed_email: "kila@example.com",
  confirmed_phone_number: "+675 7000 0003",
  prime_category: "PRIME 3",
  pricing: { category: "PRIME 3", amount: 750, interest_amount: 263, interest_rate: 0.35, total_repayable: 1013, term_days: 14 },
  monthly_income: 1400,
  employment_status: "employed",
  existing_monthly_debt: 100,
  residential_address: "Section 54, Lot 12, Hohola, Port Moresby, NCD",
  employer_name: "Digicel PNG",
  disbursement_method_requested: "cash_on_hand",
  disbursement_account_reference: null,
  referees: [],
  status: "officer_review",
  submitted_at: "2026-10-03T01:00:00Z",
};

const applicant = (a: ReviewApplication) => ({
  residentialAddress: a.residential_address,
  employerName: a.employer_name,
  employmentStatus: a.employment_status,
});

const idDoc = (id_document_type: ReviewDocument["id_document_type"]): ReviewDocument => ({
  id: 41,
  loan_application_id: 3,
  document_type: "id_verification",
  id_document_type,
  uploaded_at: "2026-10-03T00:00:00Z",
  is_current: true,
  superseded_by_id: null,
  linked_to_this_application: true,
});

function renderDocuments(documents: ReviewDocument[]) {
  render(
    <DocumentsPanel
      documents={documents}
      earlierVersions={[]}
      referees={[]}
      checklist={{ started: true, items: [] }}
      informationRequests={[]}
      verifiedIdDocumentId={null}
    />,
  );
}

describe("Application Review - applicant details", () => {
  it("shows the residence and employer the customer gave on the application", () => {
    render(<CustomerPanel customer={customer} applicant={applicant(application)} />);
    expect(screen.getByText("Section 54, Lot 12, Hohola, Port Moresby, NCD")).toBeInTheDocument();
    expect(screen.getByText("Digicel PNG")).toBeInTheDocument();
    expect(screen.queryByText(/Not collected/)).not.toBeInTheDocument();
  });

  it("labels a self-employed applicant's business, and explains a missing employer", () => {
    render(
      <CustomerPanel
        customer={customer}
        applicant={{ residentialAddress: "Boroko", employerName: "Kaupa Market Stall", employmentStatus: "self_employed" }}
      />,
    );
    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("Kaupa Market Stall")).toBeInTheDocument();
  });

  it("says 'none' for an applicant who isn't working, not 'not provided'", () => {
    render(
      <CustomerPanel
        customer={customer}
        applicant={{ residentialAddress: "Boroko", employerName: null, employmentStatus: "unemployed" }}
      />,
    );
    expect(screen.getByText("None (unemployed)")).toBeInTheDocument();
  });

  it("flags older applications that never captured these details", () => {
    render(
      <CustomerPanel
        customer={customer}
        applicant={{ residentialAddress: null, employerName: null, employmentStatus: "employed" }}
      />,
    );
    expect(screen.getAllByText("Not provided on this application")).toHaveLength(2);
    expect(screen.queryByText(/Not collected/)).not.toBeInTheDocument();
  });

  it("shows the backend's interest rate as a flat rate for the term, not an annual one", () => {
    render(<ApplicationPanel application={application} customer={customer} />);
    expect(screen.getByText("35% flat for the 14-day term")).toBeInTheDocument();
    expect(screen.getByText("K263")).toBeInTheDocument();
  });

  it("shows which kind of ID was uploaded", () => {
    renderDocuments([idDoc("passport")]);
    expect(screen.getByText(/Passport/)).toBeInTheDocument();
  });

  it("says when an old ID upload's type wasn't recorded", () => {
    renderDocuments([idDoc(null)]);
    expect(screen.getByText(/ID type not recorded/)).toBeInTheDocument();
  });
});
