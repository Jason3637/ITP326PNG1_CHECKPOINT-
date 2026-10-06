import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AccountSummary, Dashboard, LoanApplication, MyLoans } from "@/lib/types";

// Async Server Component: called as a function, its JSX rendered.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import DashboardPage from "./page";

const kpis = {
  active_loans: 1, total_loans: 1, total_borrowed: 500, outstanding_balance: 675,
  amount_repaid: 0, overdue_installments: 1, overdue_amount: 675, next_payment: null,
};
const dashboard: Dashboard = { role: "customer", generated_at: "", currency: "PGK", kpis, charts: {}, tables: { loans: [] } };

function summary(counts: Partial<AccountSummary["counts"]>): AccountSummary {
  return {
    user_id: 7,
    counts: { active: 0, overdue: 0, paid: 0, closed: 0, defaulted: 0, total: 0, ...counts },
    active_loans: [],
    next_repayment_due: null,
    has_overdue: (counts.overdue ?? 0) > 0,
  };
}

const loan = (status: string, closure_reason: string | null = null) =>
  ({
    id: 21, application_id: 31, user_id: 7, principal_amount: 500, interest_rate: 0.35, term_days: 14,
    installment_amount: 675, total_repayable: 675, status, closure_reason, disbursed_at: "2026-09-01T00:00:00Z",
    disbursement: null,
    repayment_schedule: [{ id: 1, installment_number: 1, due_date: "2026-09-15", amount_due: 675, amount_paid: 0, status: "overdue" }],
  }) as unknown as MyLoans["loans"][number];

const application = (status: string, loan_id: number | null) =>
  ({ id: 31, status, status_label: status === "disbursed" ? "Disbursed" : "Approved - Processing Disbursement", loan_id,
     amount_requested: 500, prime_category: "PRIME 2", information_requests: [], action_required_note: null,
     submitted_at: "2026-08-30T00:00:00Z" }) as unknown as LoanApplication;

function backend(opts: { counts: Partial<AccountSummary["counts"]>; loans?: MyLoans["loans"]; apps?: LoanApplication[] }) {
  serverApiFetch.mockImplementation(async (path: string) => {
    if (path === "/accounts/summary") return summary(opts.counts);
    if (path === "/reports/dashboard") return dashboard;
    if (path === "/loans/mine") return { count: opts.loans?.length ?? 0, loans: opts.loans ?? [] };
    if (path === "/loans/applications/mine") return { count: opts.apps?.length ?? 0, applications: opts.apps ?? [] };
    throw new Error(`unexpected ${path}`);
  });
}

// The Apply page is linked from both the borrowing-power card and the tiles.
const applyLinks = () => screen.queryAllByRole("link").filter((l) => l.getAttribute("href") === "/dashboard/loans/apply");

describe("customer dashboard with disbursed / closed loans", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
  });

  it("shows an OVERDUE loan as the current loan (it used to fall through to the application card)", async () => {
    backend({ counts: { overdue: 1, total: 1 }, loans: [loan("overdue")], apps: [application("disbursed", 21)] });
    render(await DashboardPage());
    expect(serverApiFetch).toHaveBeenCalledWith("/loans/mine");
    expect(screen.getByText("#21")).toBeInTheDocument(); // ActiveLoanCard
    // ...and not the application card it used to fall through to.
    expect(serverApiFetch).not.toHaveBeenCalledWith("/loans/applications/mine");
    expect(screen.queryByText("Disbursed")).not.toBeInTheDocument();
  });

  it("offers Apply again once a disbursed loan is repaid (new backend: status 'disbursed')", async () => {
    backend({ counts: { closed: 1, total: 1 }, loans: [loan("closed", "paid_in_full")], apps: [application("disbursed", 21)] });
    render(await DashboardPage());
    expect(applyLinks().length).toBeGreaterThan(0);
    expect(screen.queryByText("Disbursed")).not.toBeInTheDocument();
  });

  it("offers Apply again on the current backend too (paid-out application stays awaiting_disbursement + loan_id)", async () => {
    backend({ counts: { closed: 1, total: 1 }, loans: [loan("closed", "paid_in_full")], apps: [application("awaiting_disbursement", 21)] });
    render(await DashboardPage());
    expect(applyLinks().length).toBeGreaterThan(0);
  });

  it("still shows 'in progress' while an approved application waits for its payout", async () => {
    backend({ counts: {}, apps: [application("awaiting_disbursement", null)] });
    render(await DashboardPage());
    expect(screen.getByText("Approved - Processing Disbursement")).toBeInTheDocument();
    expect(applyLinks()).toHaveLength(0);
  });
});

describe("customer dashboard - one PRIME loan at a time", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
  });

  it("doesn't offer Apply while the customer has a current loan", async () => {
    backend({ counts: { active: 1, total: 1 }, loans: [loan("active")], apps: [application("disbursed", 21)] });
    render(await DashboardPage());
    expect(applyLinks()).toHaveLength(0);
    expect(screen.getByRole("link", { name: /My Loans/ })).toBeInTheDocument();
  });

  it("doesn't offer Apply after a write-off Prime's Vault hasn't cleared, and says why", async () => {
    backend({
      counts: { closed: 1, total: 1 },
      loans: [{ ...loan("closed", "defaulted"), blocks_reapplication: true }],
      apps: [application("disbursed", 21)],
    });
    render(await DashboardPage());
    expect(applyLinks()).toHaveLength(0);
    expect(screen.getByRole("note")).toHaveTextContent("until Prime's Vault has reviewed it");
  });

  it("offers Apply again once the write-off has been cleared", async () => {
    backend({
      counts: { closed: 1, total: 1 },
      loans: [{ ...loan("closed", "defaulted"), blocks_reapplication: false }],
      apps: [application("disbursed", 21)],
    });
    render(await DashboardPage());
    expect(applyLinks().length).toBeGreaterThan(0);
  });
});
