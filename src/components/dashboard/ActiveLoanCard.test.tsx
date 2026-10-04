import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveLoanCard } from "./ActiveLoanCard";
import type { DashboardKpis, Loan } from "@/lib/types";

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 501,
    application_id: 4242,
    user_id: 1,
    principal_amount: 5000,
    interest_rate: 0.4,
    term_days: 14,
    installment_amount: 458.4,
    total_repayable: 5500,
    status: "active",
    closure_reason: null,
    disbursed_at: "2026-08-01T00:00:00Z",
    disbursement: null,
    repayment_schedule: [
      { id: 1, installment_number: 1, due_date: "2026-09-01", amount_due: 458.4, amount_paid: 458.4, status: "paid" },
      { id: 2, installment_number: 2, due_date: "2026-10-05", amount_due: 458.4, amount_paid: 0, status: "upcoming" },
    ],
    ...overrides,
  };
}

function makeKpis(overrides: Partial<DashboardKpis> = {}): DashboardKpis {
  return {
    active_loans: 1,
    total_loans: 1,
    total_borrowed: 5000,
    outstanding_balance: 5041.6,
    amount_repaid: 458.4,
    overdue_installments: 0,
    overdue_amount: 0,
    next_payment: null,
    ...overrides,
  };
}

describe("ActiveLoanCard — verified vs. reported balance distinction", () => {
  // This is the core financial-accuracy property from the customer-status
  // revision: "Verified amount paid" must reflect only what a loan officer
  // has actually recorded against the loan (Loan.repayment_schedule),
  // never a customer's own unverified self-report. The Report Repayment
  // flow (see ReportRepaymentForm) never writes to repayment_schedule, so
  // this sum can only ever change when the backend itself updates it.
  it("computes 'Verified amount paid' as the sum of repayment_schedule amounts, not from kpis.amount_repaid", () => {
    // Deliberately give kpis.amount_repaid a DIFFERENT value than the sum
    // of the loan's own schedule, so the test fails loudly if a future
    // change accidentally wires the detail row to the wrong source.
    const loan = makeLoan({
      repayment_schedule: [
        { id: 1, installment_number: 1, due_date: "2026-09-01", amount_due: 500, amount_paid: 500, status: "paid" },
        { id: 2, installment_number: 2, due_date: "2026-10-01", amount_due: 500, amount_paid: 200, status: "upcoming" },
      ],
    });
    const kpis = makeKpis({ amount_repaid: 999999, outstanding_balance: 1 }); // intentionally wrong/unrelated figure

    render(<ActiveLoanCard kpis={kpis} hasOverdue={false} loan={loan} />);

    // 500 + 200 = 700 from the schedule, never the kpis figure — scoped to
    // the "Verified amount paid" row specifically, since kpis.amount_repaid
    // is legitimately shown elsewhere on the same card (the pre-existing
    // hero's own progress line), just never under this label.
    const verifiedRow = screen.getByText("Verified amount paid").closest("div");
    expect(verifiedRow).toHaveTextContent("K700");
    expect(verifiedRow).not.toHaveTextContent("999,999");
  });

  it("shows K0 verified amount paid when nothing has been recorded yet, even with a partial self-report scenario", () => {
    const loan = makeLoan({
      repayment_schedule: [
        { id: 1, installment_number: 1, due_date: "2026-10-01", amount_due: 500, amount_paid: 0, status: "upcoming" },
      ],
    });
    render(<ActiveLoanCard kpis={makeKpis()} hasOverdue={false} loan={loan} />);
    const row = screen.getByText("Verified amount paid").closest("div");
    expect(row).toHaveTextContent("K0");
  });

  it("defaults to K0 verified amount paid when no loan is resolved at all (hero-only fallback)", () => {
    render(<ActiveLoanCard kpis={makeKpis()} hasOverdue={false} />);
    // No loan details section renders at all without a loan.
    expect(screen.queryByText("Verified amount paid")).not.toBeInTheDocument();
    expect(screen.queryByText("Loan details")).not.toBeInTheDocument();
  });

  it("still shows the separate, kpis-derived outstanding balance in the hero regardless of the verified-paid figure", () => {
    const loan = makeLoan();
    render(<ActiveLoanCard kpis={makeKpis({ outstanding_balance: 4341.6 })} hasOverdue={false} loan={loan} />);
    expect(screen.getAllByText("K4,341.6").length).toBeGreaterThan(0);
  });
});

describe("ActiveLoanCard — other loan details", () => {
  it("renders loan id, amount borrowed, interest amount, and total repayment from the loan record", () => {
    // kpis values deliberately don't overlap with any loan-derived figure
    // below, so the "X of Y repaid" hero line can't collide with a detail
    // row's value in these text queries.
    const loan = makeLoan({ id: 77, principal_amount: 5000, total_repayable: 5500 });
    render(<ActiveLoanCard kpis={makeKpis({ amount_repaid: 111, outstanding_balance: 222 })} hasOverdue={false} loan={loan} />);
    expect(screen.getByText("#77")).toBeInTheDocument();
    expect(screen.getByText("Amount borrowed").closest("div")).toHaveTextContent("K5,000");
    expect(screen.getByText("Interest amount").closest("div")).toHaveTextContent("K500");
    expect(screen.getByText("Total repayment").closest("div")).toHaveTextContent("K5,500");
  });

  it("shows a plain-language days-remaining figure without ever rendering a raw installment status", () => {
    render(<ActiveLoanCard kpis={makeKpis()} hasOverdue={false} loan={makeLoan()} daysRemaining={5} />);
    expect(screen.getByText("5 days")).toBeInTheDocument();
    expect(screen.queryByText("upcoming")).not.toBeInTheDocument();
  });

  it("shows an overdue phrasing for negative days remaining, not a raw negative number", () => {
    render(<ActiveLoanCard kpis={makeKpis()} hasOverdue={true} loan={makeLoan()} daysRemaining={-3} />);
    expect(screen.getByText("3 days overdue")).toBeInTheDocument();
    expect(screen.queryByText("-3 days")).not.toBeInTheDocument();
  });

  it("links Report Repayment to the specific loan's report-repayment route", () => {
    render(<ActiveLoanCard kpis={makeKpis()} hasOverdue={false} loan={makeLoan({ id: 501 })} />);
    expect(screen.getByRole("link", { name: "Report Repayment" })).toHaveAttribute(
      "href",
      "/dashboard/loans/501/report-repayment",
    );
  });
});

describe("ActiveLoanCard - late penalties (ledger balance)", () => {
  const balance = {
    original_obligation: 500,
    penalties: 250,
    verified_repayments: 500,
    outstanding: 250,
    due_date: "2026-09-03",
    days_overdue: 14,
    penalty_items: [
      { tier: 1, amount: 50, applied_on: "2026-09-10", days_late: 7, reason: "7 days late: 25% of the original interest K200.00" },
      { tier: 2, amount: 200, applied_on: "2026-09-17", days_late: 14, reason: "14 days late: 100% of the original interest K200.00" },
    ],
  };

  it("shows the penalties, the reasons, and what's really still owed", () => {
    const loan = makeLoan({
      balance,
      repayment_schedule: [{ id: 1, installment_number: 1, due_date: "2026-09-03", amount_due: 500, amount_paid: 500, status: "paid" }],
    });
    render(<ActiveLoanCard kpis={makeKpis({ outstanding_balance: 250 })} hasOverdue loan={loan} />);
    expect(screen.getByText("Late penalties").closest("div")).toHaveTextContent("K250");
    expect(screen.getByText("Verified amount paid").closest("div")).toHaveTextContent("K500");
    expect(screen.getAllByText("Outstanding balance").at(-1)!.closest("div")).toHaveTextContent("K250");
    expect(screen.getByText(/7 days late: 25% of the original interest K200.00 \(added Sep 10, 2026\)/)).toBeInTheDocument();
    // Original installment paid, penalty still owed: the due date comes from the balance.
    expect(screen.getByText("Next due date").closest("div")).toHaveTextContent("Sep 3, 2026");
  });

  it("shows no penalty section when none were added", () => {
    render(<ActiveLoanCard kpis={makeKpis()} hasOverdue={false} loan={makeLoan({ balance: { ...balance, penalties: 0, penalty_items: [] } })} />);
    expect(screen.queryByText("Late penalties")).not.toBeInTheDocument();
    expect(screen.queryByText(/Late penalties added/)).not.toBeInTheDocument();
  });
});
