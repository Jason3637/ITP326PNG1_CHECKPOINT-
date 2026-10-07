import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

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

import ApplicationReviewPage from "./page";
import CustomerHistoryPage from "./customer-history/page";
import { ApiError } from "@/lib/server-api";
import { FORBIDDEN_RECOMMENDATION_WORDING } from "@/lib/recommendations";

// Shaped like the backend's raw GET /officer/applications/<id> - INCLUDING
// the fields the screen must never show, so the test can prove they don't leak.
function rawReview(overrides: { status?: string; allowed_actions?: string[]; is_mine?: boolean } = {}) {
  const status = overrides.status ?? "officer_review";
  return {
    application: {
      id: 8,
      user_id: 7,
      decided_by: 99,
      amount_requested: 900,
      purpose_category: "medical",
      purpose: "Clinic bill",
      confirmed_full_name: "Simon Wari",
      confirmed_email: "simon@test.local",
      confirmed_phone_number: "+675 7000 0000",
      prime_category: "PRIME 3",
      pricing: { category: "PRIME 3", amount: 900, interest_amount: 315, total_repayable: 1215, term_days: 14 },
      monthly_income: 1200,
      employment_status: "employed",
      existing_monthly_debt: 100,
      disbursement_method_requested: "cash_on_hand",
      disbursement_account_reference: null,
      referees: [{ id: 1, full_name: "Maria Kaupa", relationship: "sibling", mobile_number: "+675 7123 4567" }],
      status,
      submitted_at: "2026-09-24T07:16:00+00:00",
      credit_evaluation_result: { score: 45, eligible: false, recommendation: "decline" },
    },
    customer: {
      id: 7,
      full_name: "Simon Wari",
      email: "simon@test.local",
      phone_number: null,
      member_since: "2026-01-01T00:00:00+00:00",
      is_active: true,
      date_of_birth: "1988-03-14",
      verification: null,
    },
    documents: [
      {
        id: 3,
        user_id: 7,
        loan_application_id: 8,
        document_type: "proof_of_income",
        storage_path: "users/7/SECRET-STORAGE-PATH.pdf",
        uploaded_at: "2026-09-25T00:00:00+00:00",
        is_current: true,
        superseded_by_id: null,
        linked_to_this_application: true,
      },
    ],
    checklist: {
      application_id: 8,
      started: true,
      items: [
        { item_type: "valid_id", label: "Valid ID checked", required: true, status: "pending", note: null, checked_by: 1, checked_by_name: null, checked_at: null, customer_verification_id: null, evidence: null },
        { item_type: "referee", label: "Referee checked", required: true, status: "verified", note: "Called her.", checked_by: 1, checked_by_name: "Olive Officer", checked_at: "2026-09-26T00:00:00+00:00", customer_verification_id: null, evidence: null },
      ],
      summary: { total: 2, required: 2, required_complete: 1, pending: 1, failed: 0, blocking_items: ["valid_id"], ready_for_approval_recommendation: false },
    },
    information_requests: [
      {
        id: 4,
        request_type: "document_expired",
        reason: "Your payslip is from 2024.",
        required_document_type: "proof_of_income",
        required_information: null,
        internal_note: "Staff-only: HR confirmed old payslip.",
        status: "responded",
        requested_at: "2026-09-25T00:00:00+00:00",
        requested_by: 1,
        requested_by_name: "Olive Officer",
        cancelled_at: null,
        cancel_reason: null,
        response: { id: 1, response_note: "Uploaded September payslip.", responded_at: "2026-09-25T05:00:00+00:00", field_changes: null, provided_document_ids: [3] },
      },
    ],
    recommendations: [],
    admin_returns: [],
    assignment: { officer_id: 1, officer_name: "Olive Officer", assigned_at: "2026-09-24T08:00:00+00:00", is_mine: overrides.is_mine ?? true },
    credit_assessment: {
      label: "Advisory - not a decision input",
      advisory: true,
      affects_status: false,
      result: {
        algorithm: "interim-v2",
        disclaimer: "Interim model.",
        evaluated_at: "2026-09-24T07:16:00+00:00",
        score: 45,
        eligible: false,
        insufficient_data: false,
        max_eligible_amount: 450,
        reasons: ["Member account is less than 30 days old - limited track record."],
        recommendation: "decline",
        criteria_checked: ["membership_tenure"],
      },
    },
    allowed_actions: overrides.allowed_actions ?? ["update_checklist", "request_information", "recommend_approval", "recommend_rejection"],
    customer_history_url: "/api/officer/applications/8/customer-history",
  };
}

function mockBackend(review: ReturnType<typeof rawReview>) {
  serverApiFetch.mockImplementation(async (path: string) => {
    if (path === "/officer/applications/8") return review;
    if (path === "/users/7/documents?include_superseded=true") return { documents: review.documents };
    throw new Error(`unexpected path ${path}`);
  });
}

async function renderPage(search: Record<string, string> = {}, id = "8") {
  return render(
    await ApplicationReviewPage({ params: Promise.resolve({ applicationId: id }), searchParams: Promise.resolve(search) }),
  );
}

describe("Application Review workspace", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
  });

  it("renders every panel for the assigned officer", async () => {
    mockBackend(rawReview());
    await renderPage();
    for (const heading of ["Verification checklist", "Request more information", "Recommendation", "Information requests", "Customer", "Documents & referees", "Application", "Credit notes"]) {
      // Panels in tabs other than the open one are mounted but hidden (and
      // the request dialog's own title is in the page while it's closed).
      expect(screen.getAllByRole("heading", { name: heading, hidden: true }).length).toBeGreaterThan(0);
    }
    // Customer history is in the History tab itself now (the standalone
    // /customer-history page still exists).
    expect(screen.getByRole("heading", { name: "Customer history", hidden: true })).toBeInTheDocument();
    expect(screen.getByText("K1,215")).toBeInTheDocument(); // backend total, not recalculated
  });

  it("never renders the fields the raw response carries but the screen must not show", async () => {
    mockBackend(rawReview());
    const { container } = await renderPage();
    const html = container.innerHTML;
    expect(html).not.toContain("SECRET-STORAGE-PATH");
    expect(html).not.toMatch(/decline/i);
    expect(screen.queryByText("45")).not.toBeInTheDocument(); // credit score
    expect(screen.queryByText(/K450/)).not.toBeInTheDocument(); // max eligible amount
    // The staff-only internal note IS shown to staff, labelled as such.
    expect(screen.getByText("Staff-only: HR confirmed old payslip.")).toBeInTheDocument();
  });

  it("shows the customer's date of birth even before they are verified", async () => {
    mockBackend(rawReview());
    await renderPage();
    expect(screen.getByText(/Mar 14, 1988/)).toBeInTheDocument();
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
  });

  it("offers checklist editing, information requests and recommendations only when the backend allows them", async () => {
    // Another officer viewing Olive's application - the backend offers no actions.
    mockBackend(rawReview({ allowed_actions: [], is_mine: false }));
    await renderPage();
    expect(screen.queryAllByRole("radiogroup", { hidden: true })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Start a request", hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recommendation", hidden: true })).not.toBeInTheDocument();
    expect(screen.getByText("Assigned to Olive Officer. Only they or an administrator can update these checks.")).toBeInTheDocument();
  });

  it("confirms a sent information request", async () => {
    // As the backend has it right after a send: the round's request is open.
    const review = rawReview({ status: "customer_action_required", allowed_actions: ["update_checklist"] });
    review.information_requests[0] = { ...review.information_requests[0], status: "open", response: null as never };
    mockBackend(review);
    await renderPage({ requested: "2" });
    expect(screen.getByRole("status")).toHaveTextContent("2 requests sent to the customer.");
    expect(screen.getByRole("status")).toHaveTextContent("now waiting on the customer");
    expect(screen.getAllByText("Waiting on customer").length).toBeGreaterThan(0);
  });

  it("confirms a recommendation in recommend-only language", async () => {
    mockBackend(rawReview({ status: "recommended_for_approval", allowed_actions: [] }));
    await renderPage({ recommended: "recommend_approval" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Recommendation to approve sent.");
    expect(status).toHaveTextContent("now with the administrator for a decision");
    expect(status.textContent).not.toMatch(FORBIDDEN_RECOMMENDATION_WORDING);
    expect(screen.getAllByText("Recommended: approve").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Recommendation", hidden: true })).not.toBeInTheDocument();
  });

  it("ignores a forged confirmation parameter that doesn't match the application's state", async () => {
    mockBackend(rawReview());
    await renderPage({ recommended: "recommend_approval", requested: "3" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("404s for an unknown or malformed application id", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(404, "Application #999 not found.");
    });
    await expect(renderPage({}, "999")).rejects.toThrow("NOT_FOUND");
    await expect(renderPage({}, "abc")).rejects.toThrow("NOT_FOUND");
  });
});

describe("claim / resume on the review workspace", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
  });

  it("offers Claim on a new application and keeps the checklist locked until then", async () => {
    const review = rawReview({ status: "submitted", allowed_actions: ["claim"], is_mine: false });
    review.checklist = { ...review.checklist, started: false, items: [] };
    review.assignment = { ...review.assignment, officer_id: null as never, officer_name: null as never };
    mockBackend(review);
    await renderPage();
    expect(screen.getByRole("button", { name: "Claim and start review" })).toBeInTheDocument();
    expect(screen.getByText("Checks start once an officer claims this application.")).toBeInTheDocument();
    expect(screen.queryAllByRole("radiogroup", { hidden: true })).toHaveLength(0);
  });

  it("offers Resume (with a reason) while waiting on the customer", async () => {
    mockBackend(rawReview({ status: "customer_action_required", allowed_actions: ["update_checklist", "resume_review"] }));
    await renderPage();
    expect(screen.getByRole("heading", { name: "Resume the review" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toBeInTheDocument();
  });

  it("shows the newly opened checklist right after a claim, without a reload (regression)", async () => {
    // Before the claim: no checklist yet.
    const before = rawReview({ status: "submitted", allowed_actions: ["claim"], is_mine: false });
    before.checklist = { ...before.checklist, started: false, items: [] };
    mockBackend(before);
    const view = await renderPage();
    expect(screen.queryAllByRole("radiogroup", { hidden: true })).toHaveLength(0);

    // router.refresh() after the claim re-renders the same page in place with
    // new server data - VerificationChecklist must not keep its old, empty state.
    mockBackend(rawReview());
    view.rerender(
      await ApplicationReviewPage({ params: Promise.resolve({ applicationId: "8" }), searchParams: Promise.resolve({}) }),
    );
    expect(screen.getAllByRole("radiogroup", { name: / status$/, hidden: true })).toHaveLength(2); // the 2 checklist items
    expect(screen.queryByRole("button", { name: "Claim and start review" })).not.toBeInTheDocument();
  });

  it("shows neither once the officer is reviewing", async () => {
    mockBackend(rawReview());
    await renderPage();
    expect(screen.queryByRole("button", { name: "Claim and start review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Resume the review" })).not.toBeInTheDocument();
  });
});

describe("workspace structure", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
  });

  it("opens with a compact header: title, status and the headline facts", async () => {
    mockBackend(rawReview());
    await renderPage();
    const title = screen.getByRole("heading", { level: 2, name: "Application #8 · Simon Wari" });
    expect(title).toHaveAttribute("id", "workspace-heading");
    expect(title).toHaveAttribute("tabindex", "-1"); // focus target after a claim
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/staff");
    const facts = Object.fromEntries(
      screen.getAllByRole("term").slice(0, 5).map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
    );
    expect(facts).toMatchObject({ Assigned: "Assigned to you", Requested: "K900", PRIME: "PRIME 3", Purpose: "Medical" });
    expect(facts.Submitted).toMatch(/^Sep 24, 2026 · /);
  });

  it("shows review progress from the backend's checklist summary, as words and a progress bar", async () => {
    mockBackend(rawReview());
    await renderPage();
    const bar = screen.getByRole("progressbar", { name: "Required checks" });
    expect(bar).toHaveAttribute("aria-valuetext", "1 of 2 complete · 1 remaining");
    expect(screen.getAllByText("1 outstanding").length).toBeGreaterThan(0);
  });

  it("hides the progress strip until the application is claimed", async () => {
    const review = rawReview({ status: "submitted", allowed_actions: ["claim"], is_mine: false });
    review.checklist = { ...review.checklist, started: false, items: [] };
    mockBackend(review);
    await renderPage();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("splits the information into five URL tabs, Overview first, with indicators read as words", async () => {
    mockBackend(rawReview());
    await renderPage();
    const tabs = within(screen.getByRole("tablist", { name: "Application review" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Overview",
      "Verification1, 1 outstanding",
      "Documents1, 1 document",
      "Credit assessment",
      "History",
    ]);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Verification, 1 outstanding" })).toBeInTheDocument();
  });

  it.each([
    ["documents", "Documents, 1 document"],
    ["credit", "Credit assessment"],
    ["history", "History"],
    ["not-a-tab", "Overview"],
  ])("deep-links ?tab=%s to %s", async (tab, expected) => {
    mockBackend(rawReview());
    await renderPage({ tab });
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName(expected);
  });

  it("keeps the officer's actions in their own area, reachable from the header", async () => {
    mockBackend(rawReview());
    await renderPage();
    const actions = screen.getByRole("complementary", { name: "Your actions" });
    expect(actions).toHaveAttribute("id", "actions");
    expect(within(actions).getByRole("heading", { name: "Recommendation" })).toBeInTheDocument();
    expect(within(actions).getByRole("heading", { name: "Request more information" })).toBeInTheDocument();
    // Below xl the panel sits after the tabs: the header jumps to it.
    expect(screen.getByRole("link", { name: "Recommendation" })).toHaveAttribute("href", "#recommendation");
    expect(document.getElementById("recommendation")).toHaveAttribute("tabindex", "-1");
  });

  it("has no action area when the backend offers no actions", async () => {
    mockBackend(rawReview({ allowed_actions: [], is_mine: false }));
    await renderPage();
    expect(screen.queryByRole("complementary", { name: "Your actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Recommendation" })).not.toBeInTheDocument();
  });

  it("says plainly when the application is another officer's, or nobody's", async () => {
    mockBackend(rawReview({ allowed_actions: [], is_mine: false }));
    const view = await renderPage();
    // The notice's title (the same words also sit in the header and Workflow).
    expect(screen.getAllByText("Assigned to Olive Officer").some((el) => el.classList.contains("font-semibold"))).toBe(true);
    expect(screen.getByText(/Only they or an administrator can update the checks/)).toBeInTheDocument();
    view.unmount();

    const orphan = rawReview({ allowed_actions: [], is_mine: false });
    orphan.assignment = { ...orphan.assignment, officer_id: null as never, officer_name: null as never };
    mockBackend(orphan);
    await renderPage();
    expect(screen.getByText("No officer is assigned")).toBeInTheDocument();
  });

  it("shows a return above the tabs, and problems at the top of Overview", async () => {
    const review = rawReview({ status: "returned_to_officer", allowed_actions: ["resume_review"] });
    review.admin_returns = [
      { id: 1, recommendation_id: null, returned_by: 5, returned_by_name: "Ada Admin", reason: "Re-check the referee.", created_at: "2026-09-27T00:00:00+00:00" },
    ] as never;
    review.checklist.items[0] = { ...review.checklist.items[0], status: "failed", note: "Expired." } as never;
    mockBackend(review);
    const { container } = await renderPage();
    const banner = container.querySelector("[data-workflow-banner=returned]") as HTMLElement;
    expect(banner.compareDocumentPosition(screen.getByRole("tablist")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(banner).getByText(/^Returned by Ada Admin · Sep 27, 2026/)).toBeInTheDocument();
    expect(within(banner).getByText("Re-check the referee.")).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Resume the review to update the checks and send a new recommendation/);
    expect(screen.getByText("Problem found: 1 check")).toBeInTheDocument();
  });

  it("shows the waiting-on-customer banner above the tabs, with the round, when, by whom and what", async () => {
    const review = rawReview({ status: "customer_action_required", allowed_actions: ["update_checklist", "resume_review"] });
    review.information_requests = [
      { ...review.information_requests[0], status: "responded" },
      { ...review.information_requests[0], id: 9, requested_at: "2026-09-27T00:00:00+00:00", status: "open", response: null as never, request_type: "employment_confirmation", required_document_type: null, required_information: "Employer's phone number" },
      { ...review.information_requests[0], id: 10, requested_at: "2026-09-27T00:00:00+00:00", status: "open", response: null as never, request_type: "other", required_document_type: null },
    ] as never;
    mockBackend(review);
    const { container } = await renderPage();
    const banner = container.querySelector("[data-workflow-banner=waiting]")!;
    expect(banner.compareDocumentPosition(screen.getByRole("tablist")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(banner as HTMLElement).getByText("Waiting on the customer · Round 2")).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Requested Sep 27, 2026.* by Olive Officer · 2 of 2 still open/);
    expect(banner).toHaveTextContent("Employment confirmation needed - Provide: Employer's phone number");
    expect(banner).toHaveTextContent(/recommendation can be sent once the customer responds/);
    expect(container.querySelector("[data-workflow-banner=responded]")).toBeNull();
  });

  it("says the review can continue once the customer has responded - until something is recommended", async () => {
    mockBackend(rawReview()); // officer_review, the one round answered
    const view = await renderPage();
    const banner = view.container.querySelector("[data-workflow-banner=responded]")!;
    expect(banner).toHaveTextContent(/The customer responded - review can continue.*Round 1 answered Sep 25, 2026/);
    view.unmount();

    const later = rawReview();
    later.recommendations = [
      { id: 1, officer_name: "Olive Officer", recommendation: "recommend_approval", comments: "Good.", checklist_snapshot: [], created_at: "2026-09-26T00:00:00+00:00" },
    ] as never;
    mockBackend(later);
    const { container } = await renderPage();
    expect(container.querySelector("[data-workflow-banner]")).toBeNull();
  });

  it("offers Request more information in the header, one click from any tab", async () => {
    mockBackend(rawReview());
    await renderPage({ tab: "credit" });
    const header = screen.getByRole("heading", { level: 2, name: /^Application #8/ }).closest("header")!;
    expect(within(header).getByRole("button", { name: "Request more information" })).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("reads customer history through the application, and says when it isn't available", async () => {
    const review = rawReview();
    serverApiFetch.mockImplementation(async (path: string) => {
      if (path === "/officer/applications/8") return review;
      if (path === "/users/7/documents?include_superseded=true") return { documents: review.documents };
      if (path === "/officer/applications/8/customer-history") throw new ApiError(403, "Not under review.");
      throw new Error(`unexpected path ${path}`);
    });
    await renderPage({ tab: "history" });
    expect(serverApiFetch).toHaveBeenCalledWith("/officer/applications/8/customer-history");
    expect(screen.getByRole("heading", { name: "Customer history isn't available" })).toBeVisible();
    // The credit tab says the same instead of showing record figures.
    expect(screen.getByText(/customer history is shown only while the application is under review/)).toBeInTheDocument();
  });

  it("says so in History when no recommendation has been sent", async () => {
    mockBackend(rawReview());
    await renderPage({ tab: "history" });
    expect(screen.getByText("No recommendation has been sent for this application yet.")).toBeVisible();
  });
});

describe("Customer History page scoping", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
  });

  it("is fetched through the application, never by customer id", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(403, "Customer history is only available to loan officers while the application is under review.");
    });
    render(await CustomerHistoryPage({ params: Promise.resolve({ applicationId: "2" }) }));
    expect(serverApiFetch).toHaveBeenCalledWith("/officer/applications/2/customer-history");
    expect(screen.getByRole("heading", { name: "Customer history isn't available" })).toBeInTheDocument();
    expect(screen.getByText(/Application #2 has been decided/)).toBeInTheDocument();
  });
});
