import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CreditTab } from "./CreditTab";
import { toCreditAdvisory } from "@/lib/application-review";
import { FORBIDDEN_RECOMMENDATION_WORDING } from "@/lib/recommendations";
import type { CustomerHistory } from "@/lib/types";

// Shaped like the backend's stored credit_evaluation_result, including what
// the screen must never show.
const raw = {
  algorithm: "interim-v2",
  disclaimer: "Interim underwriting model - thresholds are still engineering guesses.",
  evaluated_at: "2026-09-28T01:00:00Z",
  score: 35,
  eligible: false,
  insufficient_data: false,
  max_eligible_amount: 350,
  reasons: [
    "Member account is less than 30 days old - limited track record.",
    "Debt-to-income ratio 0.62 exceeds the 0.40 limit.",
  ],
  recommendation: "decline",
  criteria_checked: ["minimum_income", "debt_to_income_ratio"],
};
const application = { amount_requested: 700, monthly_income: 1200, existing_monthly_debt: null, employment_status: "employed" as const };
const customer = { is_active: true, member_since: "2026-01-01T00:00:00Z" };
const history = {
  summary: { previous_applications: 2, previous_applications_rejected: 0, loans_total: 3, loans_active: 0, loans_overdue: 0, loans_completed: 2, loans_defaulted: 1, total_borrowed: 2100, total_repayable: 2600, total_repaid: 2000, current_exposure: 0 },
  repayment_record: { installments_paid_on_time: 10, installments_paid_late: 1, installments_currently_overdue: 0, installments_ever_overdue: 1, payments_verified: 11, payments_rejected: 0, payments_awaiting_verification: 0 },
} as unknown as CustomerHistory;

function renderTab(overrides: Partial<Parameters<typeof CreditTab>[0]> = {}) {
  return render(
    <CreditTab
      advisory={toCreditAdvisory(raw)}
      label="Advisory - not a decision input"
      application={application}
      customer={customer}
      history={{ status: "ok", history }}
      {...overrides}
    />,
  );
}

describe("CreditTab", () => {
  it("opens with the backend's advisory label and the one current disclaimer", () => {
    const { container } = renderTab();
    const note = screen.getByRole("note");
    expect(container.firstElementChild?.firstElementChild).toBe(note);
    expect(within(note).getByText("Advisory - not a decision input")).toBeInTheDocument();
    expect(note).toHaveTextContent(/does not replace the judgment of the Loan Officer or Administrator/);
    expect((container.textContent ?? "").match(/Advisory assessment only\./g)).toHaveLength(1);
  });

  it("never shows a score, verdict, cap, model name or stored disclaimer", () => {
    const { container } = renderTab();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\b35\b|K350|decline|eligible/i);
    expect(text).not.toMatch(/interim-v2|engineering guesses|Interim underwriting/);
    expect(text).not.toMatch(FORBIDDEN_RECOMMENDATION_WORDING);
  });

  it("lists the assessment's notes in its own words, with when it was generated", () => {
    renderTab();
    const notes = within(screen.getByRole("region", { name: /What the assessment noted/ }));
    expect(notes.getAllByRole("listitem").map((li) => li.textContent)).toEqual(raw.reasons);
    expect(screen.getByText(/^Generated Sep 28, 2026/)).toBeInTheDocument();
  });

  it("flags incomplete information when the assessment says so", () => {
    renderTab({ advisory: toCreditAdvisory({ ...raw, insufficient_data: true }) });
    expect(screen.getByText(/didn't report enough information/)).toBeInTheDocument();
  });

  it("shows the key figures that exist, self-reported ones marked as such", () => {
    renderTab();
    const figures = within(screen.getByRole("region", { name: "Key figures" }));
    const figure = (label: string) => figures.getByText(label).closest("div")!;
    expect(figure("Requested amount")).toHaveTextContent("K700");
    expect(figure("Monthly income")).toHaveTextContent("K1,200Self-reported, not verified");
    expect(figure("Existing monthly debt")).toHaveTextContent("Not reported");
    expect(figure("Employment status")).toHaveTextContent("Employed");
    expect(figure("Account standing")).toHaveTextContent("Active");
    expect(figure("Member since")).toHaveTextContent("Jan 1, 2026");
    expect(figure("Previous loans")).toHaveTextContent("3 loans2 completed, 1 defaulted");
    expect(figure("Repayment record")).toHaveTextContent("10 on time · 1 late0 overdue right now");
    // No debt-to-income figure: the backend doesn't send one, and it isn't
    // computed in the browser (it stays a factor name below).
    expect(figures.queryByText(/Debt-to-income/)).not.toBeInTheDocument();
  });

  it("says why the record figures are missing rather than inventing them", () => {
    const { unmount } = renderTab({ history: { status: "unavailable" } });
    expect(screen.queryByText("Previous loans")).not.toBeInTheDocument();
    expect(screen.getByText(/not available - customer history is shown only while the application is under review/)).toBeInTheDocument();
    unmount();
    renderTab({ history: { status: "error" } });
    expect(screen.getByText(/couldn't be loaded/)).toBeInTheDocument();
  });

  it("keeps the factors and inputs behind disclosures, all still in the page", () => {
    renderTab();
    const factors = screen.getByText("Assessment factors (2)").closest("details")!;
    expect(factors).not.toHaveAttribute("open");
    expect(within(factors).getByText("Monthly income")).toBeInTheDocument();
    expect(within(factors).getByText("Debt-to-income")).toBeInTheDocument();
    const inputs = screen.getByText("Inputs used from this application").closest("details")!;
    expect(inputs).toHaveTextContent("RequestedK700IncomeK1,200Existing debtnot reportedEmploymentEmployed");
  });

  it("says when no credit notes were produced", () => {
    renderTab({ advisory: null });
    expect(screen.getByText("No credit notes were produced for this application.")).toBeInTheDocument();
    expect(screen.queryByText(/Assessment factors/)).not.toBeInTheDocument();
    expect(screen.getByText("Advisory - not a decision input")).toBeInTheDocument();
  });
});
