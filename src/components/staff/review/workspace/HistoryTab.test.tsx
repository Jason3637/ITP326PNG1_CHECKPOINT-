import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HistoryTab } from "./HistoryTab";
import type { CustomerHistory } from "@/lib/types";

// Shaped exactly like officer_views.customer_history() output (the same
// fixture as CustomerHistoryView's tests).
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
    { id: 22, application_id: 32, principal_amount: 300, total_repayable: 405, amount_paid: 0, outstanding: 405, status: "overdue", closure_reason: null, disbursed_at: "2026-08-20T00:00:00+00:00", due_date: "2026-09-03", installments: { total: 1, paid_on_time: 0, paid_late: 0, overdue: 1 } },
    { id: 21, application_id: 31, principal_amount: 500, total_repayable: 675, amount_paid: 675, outstanding: 0, status: "closed", closure_reason: "paid_in_full", disbursed_at: "2026-06-03T00:00:00+00:00", due_date: "2026-06-17", installments: { total: 1, paid_on_time: 0, paid_late: 1, overdue: 0 } },
  ],
};

function renderTab(h: CustomerHistory = history, extra: Partial<Parameters<typeof HistoryTab>[0]> = {}) {
  return render(<HistoryTab applicationId={13} recommendations={[]} adminReturns={[]} history={{ status: "ok", history: h }} {...extra} />);
}
const region = (name: string) => within(screen.getByRole("region", { name: new RegExp(`^${name}`) }));
const rows = (name: string) => within(screen.getByRole("table", { name })).getAllByRole("row").slice(1);

describe("HistoryTab", () => {
  it("shows every summary measure with the backend's figures as-is", () => {
    renderTab();
    const summary = region("Summary");
    expect(summary.getByText("Previous applications").parentElement).toHaveTextContent(/^Previous applications41 rejected$/);
    expect(summary.getByText("Previous loans").parentElement).toHaveTextContent("32 completed");
    expect(summary.getByText("Total borrowed").parentElement).toHaveTextContent("K1,100K1,080 repaid so far");
    expect(summary.getByText("Current exposure").parentElement).toHaveTextContent("K405Outstanding on 1 open loan");
  });

  it("shows the repayment record and payments", () => {
    renderTab();
    const record = region("Repayment record");
    for (const [label, n] of [["Completed loans", "2"], ["On-time repayments", "1"], ["Late repayments", "1"], ["Overdue right now", "1"], ["Ever overdue (paid late or still unpaid)", "2"]]) {
      expect(record.getByText(label).nextElementSibling).toHaveTextContent(n);
    }
    expect(record.getByText("Payments: 2 verified · 0 awaiting verification · 0 rejected")).toBeInTheDocument();
  });

  it("lists every previous application and loan as a row, with status badges and no links", () => {
    const { container } = renderTab();
    expect(rows("Previous applications").map((r) => r.textContent)).toEqual([
      "#30Aug 1, 2026K300PRIME 1RejectedAug 3, 2026—",
      "#31Jun 1, 2026K500PRIME 2Approved — Awaiting DisbursementJun 2, 2026Became loan #21",
    ]);
    expect(rows("Loans").map((r) => r.textContent)).toEqual([
      "#22OverdueAug 20, 2026Sep 3, 2026K300K405K0K4050 on time, 0 late, 1 overdue (of 1)",
      "#21Closed - paid in fullJun 3, 2026Jun 17, 2026K500K675K675K00 on time, 1 late, 0 overdue (of 1)",
    ]);
    // Amount columns are right-aligned figures.
    expect(within(rows("Loans")[0]).getByText("K405", { selector: "td:nth-child(6)" })).toHaveClass("text-right", "tabular-nums");
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("says what's empty per section for a first-time customer", () => {
    renderTab({
      ...history,
      summary: { ...history.summary, previous_applications: 0, previous_applications_rejected: 0, loans_total: 0, loans_completed: 0, loans_overdue: 0, current_exposure: 0, total_borrowed: 0, total_repaid: 0 },
      previous_applications: [],
      loans: [],
    });
    expect(screen.getByText("This is the customer's first application.")).toBeInTheDocument();
    expect(screen.getByText("No previous loans.")).toBeInTheDocument();
    expect(screen.getByText("No open loans")).toBeInTheDocument();
    // Older backend (applicable: false): neutral, never "PRIME has no penalties".
    expect(screen.getByText("No late penalties charged.")).toBeInTheDocument();
    expect(screen.queryByText(/no late-payment penalty/i)).not.toBeInTheDocument();
  });

  it("shows the penalties charged, each with its loan, date, reason and amount, and the policy", () => {
    renderTab({
      ...history,
      penalties: {
        applicable: true,
        policy: "Late payments add a penalty: 25% of the loan's original interest at 7 days late.",
        count: 2,
        total_charged: 250,
        items: [
          { loan_id: 22, tier: 1, amount: 50, applied_on: "2026-09-10", days_late: 7, reason: "7 days late: 25% of the original interest K200.00" },
          { loan_id: 22, tier: 2, amount: 200, applied_on: "2026-09-17", days_late: 14, reason: "14 days late: 100% of the original interest K200.00" },
        ],
      },
    });
    expect(screen.getByText(/K250 charged across 2 penalties/)).toBeInTheDocument();
    expect(rows("Penalties").map((r) => r.textContent)).toEqual([
      "#22Sep 10, 20267 days late: 25% of the original interest K200.00K50",
      "#22Sep 17, 202614 days late: 100% of the original interest K200.00K200",
    ]);
    expect(screen.getByText(/Late payments add a penalty/)).toBeInTheDocument();
  });

  it("keeps this application's recommendations at the top, with an empty state when there are none", () => {
    renderTab();
    expect(screen.getByText("No recommendation has been sent for this application yet.")).toBeInTheDocument();
  });

  it("says customer history isn't available once decided (backend 403), or couldn't load - never an empty record", () => {
    const { unmount } = render(<HistoryTab applicationId={13} recommendations={[]} adminReturns={[]} history={{ status: "unavailable" }} />);
    expect(screen.getByRole("heading", { name: "Customer history isn't available" })).toBeInTheDocument();
    expect(screen.getByText(/Application #13 has been decided/)).toBeInTheDocument();
    expect(screen.queryByText("No previous loans.")).not.toBeInTheDocument();
    unmount();
    render(<HistoryTab applicationId={13} recommendations={[]} adminReturns={[]} history={{ status: "error" }} />);
    expect(screen.getByText(/couldn't be loaded/)).toBeInTheDocument();
  });
});
