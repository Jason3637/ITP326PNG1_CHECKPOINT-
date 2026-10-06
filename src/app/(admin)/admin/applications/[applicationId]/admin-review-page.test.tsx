import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The page is an async Server Component: called as a function, its JSX rendered.
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

import AdminApplicationReviewPage from "./page";
import { ApiError } from "@/lib/server-api";

const snapshot = [
  { item_type: "valid_id", label: "Valid ID checked", required: true, status: "verified", note: null },
  { item_type: "referee", label: "Referee checked", required: true, status: "verified", note: "Called her." },
  { item_type: "employment", label: "Employment confirmed", required: false, status: "pending", note: null },
];

// Shaped like GET /admin/applications/<id>, including fields never shown.
function rawReview(o: { status?: string; recommendation?: string; fd?: object; returns?: object[] } = {}) {
  const status = o.status ?? "recommended_for_approval";
  const awaiting = ["recommended_for_approval", "recommended_for_rejection", "admin_review"].includes(status);
  return {
    application: {
      id: 8, user_id: 7, decided_by: 99, amount_requested: 900, purpose_category: "medical", purpose: "Clinic bill",
      confirmed_full_name: "Simon Wari", confirmed_email: "simon@test.local", confirmed_phone_number: "+675 7000 0000",
      prime_category: "PRIME 3",
      pricing: { category: "PRIME 3", amount: 900, interest_amount: 315, interest_rate: 0.35, total_repayable: 1215, term_days: 14 },
      monthly_income: 1200, employment_status: "employed", existing_monthly_debt: 100,
      residential_address: "Gerehu Stage 2", employer_name: "BSP",
      disbursement_method_requested: "bsp_mobile_banking", disbursement_account_reference: "1001-2345",
      referees: [{ id: 1, full_name: "Maria Kaupa", relationship: "sibling", mobile_number: "+675 7123 4567" }],
      status, submitted_at: "2026-09-24T07:16:00+00:00",
    },
    customer: {
      id: 7, full_name: "Simon Wari", email: "simon@test.local", phone_number: null,
      member_since: "2026-01-01T00:00:00+00:00", is_active: true, date_of_birth: "1988-03-14", verification: null,
    },
    documents: [],
    checklist: {
      application_id: 8, started: true,
      items: snapshot.map((i) => ({ ...i, checked_by: 1, checked_by_name: "Olive Officer", checked_at: null, customer_verification_id: null, evidence: null })),
      summary: { total: 3, required: 2, required_complete: 2, pending: 1, failed: 0, blocking_items: [], ready_for_approval_recommendation: true },
    },
    information_requests: [],
    recommendations: [
      {
        id: 3, officer_id: 1, officer_name: "Olive Officer", recommendation: o.recommendation ?? "recommend_approval",
        comments: "ID, employer and referee confirmed.", checklist_snapshot: snapshot, created_at: "2026-09-26T01:30:00+00:00",
      },
    ],
    admin_returns: o.returns ?? [],
    assignment: { officer_id: 1, officer_name: "Olive Officer", assigned_at: "2026-09-24T08:00:00+00:00", is_mine: false },
    credit_assessment: { label: "Advisory - not a decision input", advisory: true, affects_status: false, result: null },
    allowed_actions: [],
    customer_history_url: "/api/admin/applications/8/customer-history",
    final_decision: {
      awaiting, can_approve: awaiting, can_reject: awaiting, can_return_to_officer: awaiting, can_disburse: status === "awaiting_disbursement",
      decided_at: awaiting ? null : "2026-10-01T02:00:00+00:00", decided_by: 99, loan_id: null, ...o.fd,
    },
    quote: { pricing_version_id: 1, penalty_policy_version_id: 1, interest_rate: 0.35, interest_amount: 315, total_repayable: 1215 },
  };
}

const history = {
  application_id: 8,
  customer: { id: 7, full_name: "Simon Wari", member_since: "2026-01-01T00:00:00+00:00" },
  summary: {
    previous_applications: 2, previous_applications_rejected: 1, loans_total: 1, loans_active: 0, loans_overdue: 0,
    loans_completed: 1, loans_defaulted: 0, total_borrowed: 300, total_repayable: 405, total_repaid: 405, current_exposure: 0,
  },
  repayment_record: {
    installments_paid_on_time: 1, installments_paid_late: 0, installments_currently_overdue: 0, installments_ever_overdue: 0,
    payments_verified: 1, payments_rejected: 0, payments_awaiting_verification: 0,
  },
  penalties: { applicable: true, policy: "Late payments add a penalty.", count: 0, total_charged: 0, items: [] },
  previous_applications: [],
  loans: [],
};

const loanDetail = (status = "active") => ({
  loan_id: 12,
  application_id: 8,
  status,
  terms: { principal: 900, original_total_due: 1215, term_days: 14, due_date: "2026-10-19" },
  disbursement: {
    method: "bsp_mobile_banking", amount: 900, reference: "BSP-TXN-88213", destination_masked: "•••• 2345",
    evidence_document_id: 44, disbursed_at: "2026-10-05T00:30:00+00:00", recorded_at: "2026-10-05T00:31:00+00:00",
    recorded_by: 99, recorded_by_name: "Ada Admin", note: null,
  },
});

function mockBackend(
  review: ReturnType<typeof rawReview>,
  opts: { historyFails?: boolean; loan?: ReturnType<typeof loanDetail> } = {},
) {
  serverApiFetch.mockImplementation(async (path: string) => {
    if (path === "/admin/applications/8") return review;
    if (path === "/admin/loans/12" && opts.loan) return opts.loan;
    if (path === "/admin/applications/8/customer-history") {
      if (opts.historyFails) throw new ApiError(500, "boom");
      return history;
    }
    if (path === "/users/7/documents?include_superseded=true") return { documents: [] };
    throw new Error(`unexpected path ${path}`);
  });
}

async function renderPage(search: Record<string, string> = {}, id = "8") {
  return render(
    await AdminApplicationReviewPage({ params: Promise.resolve({ applicationId: id }), searchParams: Promise.resolve(search) }),
  );
}

const card = (heading: string) => screen.getByRole("heading", { name: heading }).closest("div.rounded-xl") as HTMLElement;
const openTab = (name: RegExp | string) => userEvent.click(screen.getByRole("tab", { name }));

describe("Final Application Review", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
  });

  it("shows the customer, the application's backend figures, the officer's review and the customer history", async () => {
    mockBackend(rawReview());
    await renderPage();

    for (const heading of ["Customer", "Application", "Loan Officer review", "Final decision"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }

    const app = card("Application");
    expect(app).toHaveTextContent("#8");
    expect(app).toHaveTextContent("K900");
    expect(app).toHaveTextContent("PRIME 3");
    expect(app).toHaveTextContent("Medical");
    expect(app).toHaveTextContent("Clinic bill");
    expect(app).toHaveTextContent("BSP Mobile Banking");
    expect(app).toHaveTextContent("35% flat for the 14-day term");
    expect(app).toHaveTextContent("K315");
    expect(app).toHaveTextContent("K1,215");
    expect(app).toHaveTextContent("14 days");

    const officer = card("Loan Officer review");
    expect(officer).toHaveTextContent("Reviewed by Olive Officer");
    expect(officer).toHaveTextContent("Recommended approval");
    expect(officer).toHaveTextContent("ID, employer and referee confirmed.");
    expect(officer).toHaveTextContent("Sep 26, 2026");
    expect(officer).toHaveTextContent("2 of 2 required checks done");

    await openTab("History");
    expect(screen.getByRole("heading", { name: "Customer history" })).toBeInTheDocument();
    expect(screen.getByText("Late payments add a penalty.")).toBeVisible();
    await openTab("Verification");
    expect(screen.getByRole("heading", { name: "Verification checklist" })).toBeInTheDocument();
    expect(screen.getByText(/Read-only here/)).toBeVisible(); // the admin doesn't edit checks
  });

  it("offers the three actions while the application awaits a final decision", async () => {
    mockBackend(rawReview());
    await renderPage();
    expect(within(card("Final decision")).getAllByRole("radio")).toHaveLength(3);
  });

  it("confirms an approval as Approved — Awaiting Disbursement, never as an active loan", async () => {
    mockBackend(rawReview({ status: "awaiting_disbursement", fd: { can_disburse: true } }));
    await renderPage({ decided: "approved" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Approved — Awaiting Disbursement");
    expect(status).toHaveTextContent("No loan has been created and no money has moved");
    expect(screen.getByText("Approved — Awaiting Disbursement", { selector: "span" })).toBeInTheDocument(); // status badge
    expect(document.body.textContent).not.toMatch(/\b(loan is (now )?active|active loan|loan created)\b/i);
    expect(screen.queryByRole("heading", { name: "Final decision" })).not.toBeInTheDocument();
  });

  it("describes an approved application reached later without the banner", async () => {
    mockBackend(rawReview({ status: "awaiting_disbursement", fd: { can_disburse: true } }));
    await renderPage();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(/The loan isn't active yet: it's created when the money is paid out/)).toBeInTheDocument();
  });

  it("only shows an outcome banner the application's real status backs up", async () => {
    mockBackend(rawReview());
    await renderPage({ decided: "approved" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("confirms a return to the loan officer", async () => {
    mockBackend(rawReview({ status: "returned_to_officer" }));
    await renderPage({ decided: "returned" });
    expect(screen.getByRole("status")).toHaveTextContent("Returned to the loan officer");
  });

  it("shows earlier rounds when the application was returned before", async () => {
    mockBackend(rawReview({ returns: [{ id: 1, recommendation_id: 3, returned_by_name: "Ada Admin", reason: "Check the payslip.", created_at: null }] }));
    await renderPage();
    expect(screen.getByRole("heading", { name: "Recommendations" })).toBeInTheDocument();
    expect(screen.getByText("Check the payslip.")).toBeInTheDocument();
  });

  it("keeps working when the customer history can't be loaded", async () => {
    mockBackend(rawReview(), { historyFails: true });
    await renderPage({ tab: "history" });
    expect(screen.getByRole("heading", { name: "Customer history couldn't be loaded" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Final decision" })).toBeInTheDocument();
  });

  it("never renders internal ids", async () => {
    mockBackend(rawReview({ status: "awaiting_disbursement" }));
    const { container } = await renderPage();
    expect(container.innerHTML).not.toMatch(/\b99\b/); // decided_by
  });

  it("404s for an unknown or malformed application", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(404, "not found");
    });
    await expect(renderPage({}, "8")).rejects.toThrow("NOT_FOUND");
    await expect(renderPage({}, "abc")).rejects.toThrow("NOT_FOUND");
  });
});

describe("The review workspace", () => {
  beforeEach(() => {
    // Block body on purpose - see above.
    serverApiFetch.mockReset();
    window.history.replaceState(null, "", "/admin/applications/8");
  });

  it("opens with a compact header: number, status, customer, amount, category, purpose, submission date", async () => {
    mockBackend(rawReview());
    await renderPage();
    const header = screen.getByRole("heading", { level: 2, name: "Application #8" }).closest("header") as HTMLElement;
    expect(within(header).getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/admin");
    expect(header).toHaveTextContent("Recommended: approve");
    expect(header).toHaveTextContent("Simon Wari");
    expect(header).toHaveTextContent("K900 · PRIME 3 · Medical");
    expect(header).toHaveTextContent("Submitted Sep 24, 2026");
  });

  it("states where the application stands and jumps to the action", async () => {
    mockBackend(rawReview());
    await renderPage();
    expect(screen.getByText("Waiting on your final decision")).toBeInTheDocument();
    expect(screen.getByText(/Olive Officer: recommended approval/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Make the decision" })).toHaveAttribute("href", "#action-panel");
    expect(document.getElementById("action-panel")).toContainElement(screen.getByRole("heading", { name: "Final decision" }));
  });

  it("offers Record disbursement from the status once approved, opening the dialog", async () => {
    mockBackend(rawReview({ status: "awaiting_disbursement", fd: { can_disburse: true } }));
    await renderPage();
    const [fromStatus, fromPanel] = screen.getAllByRole("button", { name: "Record disbursement" });
    expect(fromPanel).toBeInTheDocument(); // the action panel has its own
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(fromStatus);
    expect(screen.getByRole("dialog", { name: "Record disbursement" })).toBeInTheDocument();
  });

  it("splits the information into five tabs, Overview first", async () => {
    mockBackend(rawReview());
    await renderPage();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Overview",
      "Verification",
      "Documents0",
      "Credit assessment",
      "History",
    ]);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("heading", { name: "Credit notes" })).not.toBeInTheDocument(); // hidden until chosen
  });

  it("keeps every piece of information reachable: each panel is in a tab", async () => {
    mockBackend(rawReview({ returns: [{ id: 1, recommendation_id: 3, returned_by_name: "Ada Admin", reason: "Check the payslip.", created_at: null }] }));
    await renderPage();
    const where: Record<string, string> = {
      Overview: "Loan Officer review|Recommendations|Customer|Application",
      Verification: "Customer verification|Verification checklist|Information requests",
      Documents: "Documents & referees",
      "Credit assessment": "Credit notes",
      History: "Customer history|Repayment record|Penalties|Previous applications|Loans",
    };
    for (const [tab, headings] of Object.entries(where)) {
      await openTab(new RegExp(`^${tab}`));
      for (const h of headings.split("|")) expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
    // The action panel stays outside the tabs, visible from every one.
    expect(screen.getByRole("heading", { name: "Final decision" })).toBeInTheDocument();
  });

  it("opens the tab named in ?tab=, and falls back to Overview for anything else", async () => {
    mockBackend(rawReview());
    const first = await renderPage({ tab: "credit" });
    expect(screen.getByRole("tab", { name: "Credit assessment" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Credit notes" })).toBeInTheDocument();
    expect(screen.getByText(/does not replace the judgment/)).toBeVisible(); // advisory only, as before
    first.unmount();

    await renderPage({ tab: "nope" });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("writes the tab to the URL without dropping other parameters", async () => {
    window.history.replaceState(null, "", "/admin/applications/8?decided=approved");
    mockBackend(rawReview());
    await renderPage();
    await openTab("Verification");
    expect(window.location.search).toBe("?decided=approved&tab=verification");
    await openTab("Overview");
    expect(window.location.search).toBe("?decided=approved");
  });

  it("moves between tabs with the arrow keys", async () => {
    mockBackend(rawReview());
    await renderPage();
    screen.getByRole("tab", { name: "Overview" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Verification" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Verification" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("loses nothing typed or expanded when switching tabs", async () => {
    mockBackend(rawReview());
    await renderPage();
    const decision = card("Final decision");
    await userEvent.click(within(decision).getByRole("radio", { name: /Reject/ }));
    await userEvent.type(within(decision).getByRole("textbox"), "Payslip doesn't match.");
    const everyCheck = screen.getByText("Every check").closest("details") as HTMLDetailsElement;
    await userEvent.click(screen.getByText("Every check"));
    expect(everyCheck.open).toBe(true);

    for (const tab of ["Verification", "History", "Credit assessment", "Overview"]) await openTab(tab);

    expect(within(card("Final decision")).getByRole("radio", { name: /Reject/ })).toBeChecked();
    expect(within(card("Final decision")).getByRole("textbox")).toHaveValue("Payslip doesn't match.");
    expect(everyCheck.open).toBe(true);
  });
});

describe("Recording the disbursement", () => {
  beforeEach(() => {
    // Block body on purpose - see above.
    serverApiFetch.mockReset();
  });

  it("offers the disbursement form, not the decision, once approved", async () => {
    mockBackend(rawReview({ status: "awaiting_disbursement", fd: { can_disburse: true } }));
    await renderPage();
    expect(within(card("Disbursement")).getByRole("button", { name: "Record disbursement" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Final decision" })).not.toBeInTheDocument();
    expect(screen.getByText("•••• 2345")).toBeInTheDocument(); // masked from the application's account
    expect(document.body.textContent).not.toMatch(/Loan Active/);
  });

  it("shows Loan Active only from the backend's loan record after the save", async () => {
    mockBackend(rawReview({ status: "disbursed", fd: { loan_id: 12 } }), { loan: loanDetail("active") });
    await renderPage({ disbursed: "12" });
    expect(screen.getByRole("status")).toHaveTextContent("Disbursement recorded · Loan Active");
    expect(screen.getByRole("status")).toHaveTextContent("Loan #12 is active. K1,215 is due Oct 19, 2026.");
    const record = card("Disbursement");
    expect(record).toHaveTextContent("Loan Active");
    expect(record).toHaveTextContent("BSP-TXN-88213");
    expect(record).toHaveTextContent("•••• 2345");
    expect(record).toHaveTextContent("by Ada Admin");
    expect(screen.getByRole("link", { name: "Open loan #12" })).toHaveAttribute("href", "/admin/loans/12");
    expect(screen.queryByRole("heading", { name: "Record disbursement" })).not.toBeInTheDocument();
  });

  it("doesn't say Loan Active when the backend says otherwise", async () => {
    mockBackend(rawReview({ status: "disbursed", fd: { loan_id: 12 } }), { loan: loanDetail("overdue") });
    await renderPage({ disbursed: "12" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Loan Active/);
    expect(card("Disbursement")).toHaveTextContent("Loan Overdue");
  });

  it("ignores a ?disbursed= that doesn't match the application's loan", async () => {
    mockBackend(rawReview({ status: "disbursed", fd: { loan_id: 12 } }), { loan: loanDetail("active") });
    await renderPage({ disbursed: "13" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says the loan record couldn't be loaded rather than guessing", async () => {
    mockBackend(rawReview({ status: "disbursed", fd: { loan_id: 12 } })); // /admin/loans/12 throws
    await renderPage({ disbursed: "12" });
    expect(screen.getByText(/loan record couldn't be loaded/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Loan Active/);
  });
});
