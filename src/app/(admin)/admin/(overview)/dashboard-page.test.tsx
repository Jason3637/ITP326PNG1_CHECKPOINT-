import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { AdminQueue, AdminQueuePage } from "@/lib/types";
import {
  analytics,
  applicationItem,
  loanItem,
  queueCounts,
  queuePage,
  repaymentItem,
} from "@/components/admin/admin-fixtures.test-utils";

// The page is an async Server Component: called as a function, its JSX rendered.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import AdminDashboardPage from "./page";
import { UnauthenticatedError } from "@/lib/server-api";

function backend(pages: Partial<Record<AdminQueue, AdminQueuePage>> = {}, extra: { counts?: object; analytics?: object } = {}) {
  serverApiFetch.mockImplementation(async (path: string) => {
    if (path === "/admin/queues") return extra.counts ?? queueCounts();
    if (path === "/admin/analytics") return extra.analytics ?? analytics();
    const key = path.match(/^\/admin\/queues\/([a-z_]+)\?per_page=5$/)?.[1] as AdminQueue | undefined;
    if (key) return pages[key] ?? queuePage(key);
    throw new Error(`unexpected path ${path}`);
  });
}

const section = (title: string) => screen.getByRole("heading", { name: title }).closest("[id^=queue-]") as HTMLElement;
const card = (title: string) => screen.getByRole("heading", { name: title }).closest("li") as HTMLElement;

describe("Administrator dashboard", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
  });

  it("shows all seven queues, each with its backend total", async () => {
    backend({ overdue: queuePage("overdue", [loanItem(1, { days_overdue: 3 })], 9) });
    render(await AdminDashboardPage());
    for (const title of [
      "Applications Awaiting Final Decision",
      "Approved — Awaiting Disbursement",
      "Active Loans",
      "Due Today",
      "Due This Week",
      "Overdue Loans",
      "Repayments Awaiting Verification",
    ]) {
      expect(section(title)).toBeInTheDocument();
    }
    expect(within(section("Overdue Loans")).getByText("9")).toBeInTheDocument();
    expect(within(section("Overdue Loans")).getByRole("link", { name: "View all 9" })).toHaveAttribute(
      "href",
      "/admin/queues/overdue",
    );
    expect(within(section("Due Today")).getByText("Nothing is due today.")).toBeInTheDocument();
  });

  it("asks the backend for each queue's first 5 items, plus the counts and analytics", async () => {
    backend();
    await AdminDashboardPage();
    const paths = serverApiFetch.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/admin/queues");
    expect(paths).toContain("/admin/analytics");
    expect(paths.filter((p: string) => p.endsWith("?per_page=5"))).toHaveLength(7);
  });

  it("answers the five questions from the backend's figures, not from the listed items", async () => {
    // The listed items deliberately don't add up to the figures: the
    // dashboard must show the backend's numbers, never sum a page of items.
    backend(
      {
        active_loans: queuePage("active_loans", [loanItem(1, { outstanding: 10 }), loanItem(2, { outstanding: 20 })], 2),
        repayments_awaiting_verification: queuePage("repayments_awaiting_verification", [repaymentItem(1)], 1),
      },
      {
        counts: queueCounts({
          awaiting_decision: 6,
          awaiting_disbursement: 2,
          due_today: 1,
          due_this_week: 4,
          overdue: 3,
          repayments_awaiting_verification: 11,
        }),
        analytics: analytics({ outstanding_value: 1234.5, active_loans: 3, principal_disbursed: 2100, loans_disbursed: 4, overdue_value: 310 }),
      },
    );
    render(await AdminDashboardPage());

    const attention = card("Needs your attention");
    expect(within(attention).getByRole("link", { name: /Waiting on a final decision\s*6/ })).toHaveAttribute("href", "#queue-awaiting_decision");
    expect(within(attention).getByRole("link", { name: /Approved, waiting to be paid out\s*2/ })).toHaveAttribute("href", "#queue-awaiting_disbursement");

    const disbursed = card("Disbursed");
    expect(within(disbursed).getByText("K2,100")).toBeInTheDocument();
    expect(within(disbursed).getByText("4 loans paid out, Sep 6, 2026 – Oct 5, 2026")).toBeInTheDocument();
    expect(within(disbursed).getByText("Sum of principal paid out in the period.")).toBeInTheDocument();

    const outstanding = card("Outstanding");
    expect(within(outstanding).getByText("K1,234.5")).toBeInTheDocument(); // not K30 from the two listed loans
    expect(within(outstanding).getByText("Across 3 active loans")).toBeInTheDocument();
    expect(within(outstanding).getByText("What is still owed, from the ledger.")).toBeInTheDocument();

    const due = card("Due and overdue");
    expect(within(due).getByRole("link", { name: /Due today\s*1/ })).toHaveAttribute("href", "#queue-due_today");
    expect(within(due).getByRole("link", { name: /Due this week\s*4/ })).toHaveAttribute("href", "#queue-due_this_week");
    expect(within(due).getByRole("link", { name: /Overdue\s*3\s*K310 owed/ })).toHaveAttribute("href", "#queue-overdue");

    const verification = card("Awaiting verification");
    expect(within(verification).getByText("11")).toBeInTheDocument(); // not 1 listed item
  });

  it("links every queue item to its workspace", async () => {
    backend({
      awaiting_decision: queuePage("awaiting_decision", [applicationItem(8)]),
      awaiting_disbursement: queuePage("awaiting_disbursement", [
        applicationItem(9, { status: "awaiting_disbursement", decided_at: "2026-10-01T00:00:00+00:00" }),
      ]),
      overdue: queuePage("overdue", [loanItem(4, { days_overdue: 3, outstanding: 250, penalties: 50 })]),
      repayments_awaiting_verification: queuePage("repayments_awaiting_verification", [repaymentItem(12)]),
    });
    render(await AdminDashboardPage());

    const decision = within(section("Applications Awaiting Final Decision")).getByRole("link", { name: /#8 · Customer 8/ });
    expect(decision).toHaveAttribute("href", "/admin/applications/8");
    expect(decision).toHaveTextContent("Olive Officer recommends: approve");

    const payout = within(section("Approved — Awaiting Disbursement")).getByRole("link", { name: /#9 · Customer 9/ });
    expect(payout).toHaveAttribute("href", "/admin/applications/9");
    expect(payout).toHaveTextContent("Approved Oct 1, 2026");

    const loan = within(section("Overdue Loans")).getByRole("link", { name: /Loan #4 · Borrower 4/ });
    expect(loan).toHaveAttribute("href", "/admin/loans/4");
    expect(loan).toHaveTextContent("3 days overdue");
    expect(loan).toHaveTextContent("K250 owed of K450, including K50 in penalties");
    expect(loan).toHaveTextContent("Due Oct 9, 2026");

    const repayment = within(section("Repayments Awaiting Verification")).getByRole("link", { name: /K200 · Loan #30/ });
    expect(repayment).toHaveAttribute("href", "/admin/loans/30/repayments/12");
    expect(repayment).toHaveTextContent("BSP Mobile Banking · Ref BSP-123");
    expect(repayment).toHaveTextContent("1 receipt");
    expect(repayment).toHaveTextContent("Paid Oct 3, 2026");
  });

  it("flags a reported repayment with no receipt", async () => {
    backend({
      repayments_awaiting_verification: queuePage("repayments_awaiting_verification", [repaymentItem(1, { receipts: [] })]),
    });
    render(await AdminDashboardPage());
    expect(within(section("Repayments Awaiting Verification")).getByText(/No receipt attached/)).toBeInTheDocument();
  });

  it("sends an expired session to /login", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new UnauthenticatedError();
    });
    await expect(AdminDashboardPage()).rejects.toThrow("REDIRECT:/login");
  });
});
