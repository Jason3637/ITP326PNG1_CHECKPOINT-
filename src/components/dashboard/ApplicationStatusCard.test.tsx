import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApplicationStatusCard } from "./ApplicationStatusCard";
import type { LoanApplication } from "@/lib/types";

function application(overrides: Partial<LoanApplication> = {}): LoanApplication {
  return {
    id: 42,
    user_id: 1,
    amount_requested: 5000,
    purpose_category: "business",
    purpose: null,
    confirmed_full_name: "Jane Doe",
    confirmed_email: "jane@example.com",
    confirmed_phone_number: null,
    prime_category: "PRIME 3",
    pricing: null,
    monthly_income: null,
    employment_status: null,
    existing_monthly_debt: null,
    disbursement_method_requested: "cash_on_hand",
    disbursement_account_reference: null,
    referees: [],
    policy_version_accepted: "2026-09-v1",
    status: "officer_review",
    status_label: "Under Review",
    action_required_note: null,
    information_requests: [],
    credit_evaluation_result: null,
    submitted_at: "2026-01-01T00:00:00.000Z",
    decided_at: null,
    decided_by: null,
    loan_id: null,
    ...overrides,
  };
}

// The component trusts application.status_label verbatim - the backend
// (app/services/loan_processing.py:status_label()) is the single source of
// truth for what's customer-safe, precisely so this card never has to
// duplicate or guess that mapping.
describe("ApplicationStatusCard", () => {
  it("renders status_label as given, never the raw status field", () => {
    render(<ApplicationStatusCard application={application({ status: "officer_review", status_label: "Under Review" })} />);
    expect(screen.getByText("Under Review")).toBeInTheDocument();
    expect(screen.queryByText(/officer_review/)).not.toBeInTheDocument();
  });

  it("links to the respond page and shows the officer's note when action is required", () => {
    render(
      <ApplicationStatusCard
        application={application({
          status: "customer_action_required",
          status_label: "Action Required",
          action_required_note: "Please add a second referee.",
        })}
      />,
    );
    expect(screen.getByText("Action Required")).toBeInTheDocument();
    expect(screen.getByText("Please add a second referee.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Respond now" })).toHaveAttribute(
      "href",
      "/dashboard/applications/42/respond",
    );
  });

  it("shows the awaiting-disbursement label and links onward rather than to re-apply", () => {
    render(
      <ApplicationStatusCard
        application={application({ status: "awaiting_disbursement", status_label: "Approved - Processing Disbursement" })}
      />,
    );
    expect(screen.getByText("Approved - Processing Disbursement")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute("href", "/dashboard/applications");
  });

  it("shows Not Approved and offers to apply again for a rejected application", () => {
    render(<ApplicationStatusCard application={application({ status: "rejected", status_label: "Not Approved" })} />);
    expect(screen.getByText("Not Approved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apply again" })).toHaveAttribute("href", "/dashboard/loans/apply");
  });

  it("renders the requested amount", () => {
    render(<ApplicationStatusCard application={application({ amount_requested: 12345 })} />);
    expect(screen.getByText("K12,345")).toBeInTheDocument();
  });
});
