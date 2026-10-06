import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { loanDetail } from "@/components/admin/admin-fixtures.test-utils";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import AdminLoanPage from "./page";
import { ApiError } from "@/lib/server-api";

const card = (heading: string) => screen.getByRole("heading", { name: heading }).closest("div.rounded-xl") as HTMLElement;
const renderLoan = async (id = "5", search: Record<string, string> = {}) =>
  render(await AdminLoanPage({ params: Promise.resolve({ loanId: id }), searchParams: Promise.resolve(search) }));

describe("Active Loan detail", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
  });

  it("shows every loan figure from the backend", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await renderLoan();
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/loans/5");
    const loan = card("Loan");
    for (const t of ["#5", "Simon Ere", "K600", "PRIME 2", "K240", "40% flat for the 14-day term", "K840", "K300", "K60", "Sep 24, 2026", "11 days"]) {
      expect(loan).toHaveTextContent(t);
    }
    expect(within(loan).getByText("Outstanding balance").closest("div")).toHaveTextContent("K600");
    expect(screen.getAllByText("Loan Overdue").length).toBeGreaterThan(0); // header and disbursement card
    expect(screen.queryByText("Loan Active")).not.toBeInTheDocument();
  });

  it("tells the ledger's story in order: obligation, repayment, penalty", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await renderLoan();
    const items = within(card("Ledger")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/Original amount owed.*\+ K840.*Balance K840/),
      expect.stringMatching(/Verified repayment · payment #3.*Matched on statement.*− K300.*Balance K540/),
      expect.stringMatching(/Late penalty, tier 1.*Added by the system.*7 days late.*\+ K60.*Balance K600/),
    ]);
    expect(within(card("Ledger")).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("flags a ledger that doesn't add up to the backend's outstanding", async () => {
    serverApiFetch.mockResolvedValue(loanDetail({ balance: { ...loanDetail().balance, outstanding: 999 } }));
    await renderLoan();
    expect(within(card("Ledger")).getByRole("alert")).toHaveTextContent("doesn't match");
  });

  it("lists every payment, newest first, each linking to its workspace", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await renderLoan();
    const links = within(card("Payment history")).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/admin/loans/5/repayments/4",
      "/admin/loans/5/repayments/3",
      "/admin/loans/5/repayments/2",
    ]);
    expect(links[0]).toHaveTextContent("Awaiting verification");
    expect(links[2]).toHaveTextContent("Rejected: No such BSP transaction.");
  });

  it("shows the audit history without internal ids or paths", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    const { container } = await renderLoan();
    const audit = card("Audit history");
    expect(audit).toHaveTextContent("Disbursed · loan created");
    expect(audit).toHaveTextContent("Late penalty added");
    expect(audit).toHaveTextContent("System");
    expect(container.innerHTML).not.toContain("SECRET-PATH");
    expect(container.innerHTML).not.toContain("never/shown");
    expect(audit.textContent).not.toMatch(/\b77\b/);
  });

  it("404s for an unknown or malformed loan", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(404, "Loan #99 not found.");
    });
    await expect(renderLoan("99")).rejects.toThrow("NOT_FOUND");
    await expect(renderLoan("abc")).rejects.toThrow("NOT_FOUND");
  });
});

describe("Written-off loans: applying again", () => {
  beforeEach(() => {
    // Block body on purpose - see above.
    serverApiFetch.mockReset();
  });

  const writtenOff = (reapplication: unknown) =>
    loanDetail({ status: "closed", closure: { closure_reason: "defaulted", closed_at: null, total_verified_paid: 0, total_penalties: 0, outstanding_at_closure: 600, final_payment_date: null }, reapplication });

  it("offers 'Clear to apply again' while the write-off still blocks the customer", async () => {
    serverApiFetch.mockResolvedValue(writtenOff({ blocked: true, cleared_at: null, cleared_by: null, cleared_by_name: null, reason: null }));
    await renderLoan();
    expect(screen.getByRole("heading", { name: "Applying again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear to apply again" })).toBeInTheDocument();
  });

  it("confirms the clearance only when the backend shows it cleared", async () => {
    serverApiFetch.mockResolvedValue(writtenOff({ blocked: false, cleared_at: "2026-10-06T00:00:00+00:00", cleared_by: 77, cleared_by_name: "Ada Admin", reason: "Settled." }));
    await renderLoan("5", { cleared: "1" });
    expect(screen.getByRole("status")).toHaveTextContent("Cleared. The customer can apply for a new PRIME loan.");
    serverApiFetch.mockResolvedValue(writtenOff({ blocked: true, cleared_at: null, cleared_by: null, cleared_by_name: null, reason: null }));
    await renderLoan("5", { cleared: "1" });
    expect(screen.getAllByRole("status")).toHaveLength(1); // only the first render's
  });

  it("shows nothing about applying again for a loan that wasn't written off", async () => {
    serverApiFetch.mockResolvedValue(loanDetail({ reapplication: null }));
    await renderLoan();
    expect(screen.queryByRole("heading", { name: "Applying again" })).not.toBeInTheDocument();
  });
});

describe("Writing off a loan", () => {
  beforeEach(() => {
    // Block body on purpose - see above.
    serverApiFetch.mockReset();
  });

  it("offers it on an overdue loan with something owing", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await renderLoan();
    expect(screen.getByRole("button", { name: "Write off this loan" })).toBeInTheDocument();
  });

  it("doesn't offer it on a closed loan, or one with nothing owing", async () => {
    serverApiFetch.mockResolvedValue(loanDetail({ status: "closed", closure: { closure_reason: "paid_in_full", closed_at: null, total_verified_paid: 840, total_penalties: 0, outstanding_at_closure: 0, final_payment_date: null } }));
    await renderLoan();
    expect(screen.queryByRole("button", { name: "Write off this loan" })).not.toBeInTheDocument();
    serverApiFetch.mockResolvedValue(loanDetail({ balance: { ...loanDetail().balance, outstanding: 0 } }));
    await renderLoan();
    expect(screen.queryByRole("button", { name: "Write off this loan" })).not.toBeInTheDocument();
  });

  it("confirms a write-off only when the backend shows it written off", async () => {
    serverApiFetch.mockResolvedValue(loanDetail({ status: "closed", closure: { closure_reason: "defaulted", closed_at: null, total_verified_paid: 300, total_penalties: 60, outstanding_at_closure: 600, final_payment_date: null }, reapplication: { blocked: true, cleared_at: null, cleared_by: null, cleared_by_name: null, reason: null } }));
    await renderLoan("5", { written_off: "1" });
    expect(screen.getByRole("status")).toHaveTextContent("Loan #5 is written off, with K600 still owed.");
    expect(screen.getByRole("button", { name: "Clear to apply again" })).toBeInTheDocument();
  });
});
