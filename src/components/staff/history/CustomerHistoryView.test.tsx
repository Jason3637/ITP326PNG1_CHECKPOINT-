import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CustomerHistoryView } from "./CustomerHistoryView";
import { loanStatusLabel, loanStatusTone } from "@/lib/customer-history";
import type { CustomerHistory } from "@/lib/types";

// Shaped exactly like officer_views.customer_history() output.
const history: CustomerHistory = {
  application_id: 13,
  customer: { id: 7, full_name: "Rose Hela", member_since: "2025-01-10T00:00:00+00:00" },
  summary: {
    previous_applications: 4,
    previous_applications_rejected: 1,
    loans_total: 3,
    loans_active: 0,
    loans_overdue: 1,
    loans_completed: 2,
    loans_defaulted: 0,
    total_borrowed: 1100,
    total_repayable: 1485,
    total_repaid: 1080,
    current_exposure: 405,
  },
  repayment_record: {
    installments_paid_on_time: 1,
    installments_paid_late: 1,
    installments_currently_overdue: 1,
    installments_ever_overdue: 2,
    payments_verified: 2,
    payments_rejected: 0,
    payments_awaiting_verification: 0,
  },
  penalties: { applicable: false, note: "PRIME loans carry no late-payment penalty." },
  previous_applications: [
    { id: 30, submitted_at: "2026-08-01T00:00:00+00:00", amount_requested: 300, prime_category: "PRIME 1", status: "rejected", decided_at: "2026-08-03T00:00:00+00:00", loan_id: null },
    { id: 31, submitted_at: "2026-06-01T00:00:00+00:00", amount_requested: 500, prime_category: "PRIME 2", status: "awaiting_disbursement", decided_at: "2026-06-02T00:00:00+00:00", loan_id: 21 },
  ],
  loans: [
    {
      id: 22,
      application_id: 32,
      principal_amount: 300,
      total_repayable: 405,
      amount_paid: 0,
      outstanding: 405,
      status: "overdue",
      closure_reason: null,
      disbursed_at: "2026-08-20T00:00:00+00:00",
      due_date: "2026-09-03",
      installments: { total: 1, paid_on_time: 0, paid_late: 0, overdue: 1 },
    },
    {
      id: 21,
      application_id: 31,
      principal_amount: 500,
      total_repayable: 675,
      amount_paid: 675,
      outstanding: 0,
      status: "closed",
      closure_reason: "paid_in_full",
      disbursed_at: "2026-06-03T00:00:00+00:00",
      due_date: "2026-06-17",
      installments: { total: 1, paid_on_time: 0, paid_late: 1, overdue: 0 },
    },
  ],
};

describe("CustomerHistoryView", () => {
  it("shows every required measure, with the backend's figures as-is", () => {
    render(<CustomerHistoryView history={history} />);
    const stat = screen.getAllByText("Previous applications").find((el) => el.tagName === "SPAN")!;
    expect(stat.parentElement).toHaveTextContent(/^Previous applications4/);
    expect(screen.getByText("1 rejected")).toBeInTheDocument();
    expect(screen.getByText("K1,100")).toBeInTheDocument(); // total borrowed
    expect(screen.getByText("K405")).toBeInTheDocument(); // current exposure
    expect(screen.getByText("Outstanding on 1 open loan")).toBeInTheDocument();
    const record = screen.getByText("Repayment record").closest("div.rounded-xl") as HTMLElement;
    expect(within(record).getByText("Completed loans").nextSibling).toHaveTextContent("2");
    expect(within(record).getByText("On-time repayments").nextSibling).toHaveTextContent("1");
    expect(within(record).getByText("Late repayments").nextSibling).toHaveTextContent("1");
    expect(within(record).getByText("Overdue right now").nextSibling).toHaveTextContent("1");
    expect(screen.getByText("Not applicable")).toBeInTheDocument(); // penalties
  });

  it("lists previous applications and loans without linking to them", () => {
    const { container } = render(<CustomerHistoryView history={history} />);
    expect(screen.getByText(/Application #30/)).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/became loan #21/)).toBeInTheDocument();
    expect(screen.getByText("Closed - paid in full")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("handles a first-time customer", () => {
    render(
      <CustomerHistoryView
        history={{
          ...history,
          summary: { ...history.summary, previous_applications: 0, previous_applications_rejected: 0, loans_total: 0, loans_completed: 0, loans_overdue: 0, current_exposure: 0, total_borrowed: 0, total_repaid: 0 },
          previous_applications: [],
          loans: [],
        }}
      />,
    );
    expect(screen.getByText("This is the customer's first application.")).toBeInTheDocument();
    expect(screen.getByText("No loans yet.")).toBeInTheDocument();
    expect(screen.getByText("No open loans")).toBeInTheDocument();
  });
});

describe("loan status labels", () => {
  it("spells out why a loan was closed", () => {
    expect(loanStatusLabel({ status: "closed", closure_reason: "defaulted" })).toBe("Closed - defaulted");
    expect(loanStatusTone({ status: "closed", closure_reason: "defaulted" })).toBe("danger");
    expect(loanStatusLabel({ status: "paid", closure_reason: null })).toBe("Paid");
    expect(loanStatusLabel({ status: "weird", closure_reason: null })).toBe("Unknown status");
  });
});
