import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewRecommendation } from "@/lib/types";

const submitRecommendation = vi.fn();
const replace = vi.fn();
vi.mock("@/lib/actions/recommendations", () => ({ submitRecommendation: (...a: unknown[]) => submitRecommendation(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

import { RecommendationForm, type ChecklistState } from "./RecommendationForm";
import { RecommendationHistoryPanel } from "./RecommendationHistoryPanel";
import {
  FORBIDDEN_RECOMMENDATION_WORDING,
  RECOMMENDATION_COPY,
  validateRecommendation,
} from "@/lib/recommendations";

const complete: ChecklistState = { started: true, required: 7, requiredComplete: 7, outstanding: [], failed: [], ready: true };
const incomplete: ChecklistState = {
  started: true,
  required: 7,
  requiredComplete: 5,
  outstanding: ["Referee checked"],
  failed: ["Valid ID checked"],
  ready: false,
};

function renderForm(checklist = complete) {
  return render(
    <RecommendationForm applicationId={9} checklist={checklist} canRecommendApproval canRecommendRejection />,
  );
}

function allCopy(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function") {
      out.push(String(v("recommend_approval")), String(v("recommend_rejection")), String(v(9)));
    } else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(RECOMMENDATION_COPY);
  return out;
}

describe("recommendation wording", () => {
  it("never implies a decision, an active loan or money moving - in any string", () => {
    for (const text of allCopy()) expect(text).not.toMatch(FORBIDDEN_RECOMMENDATION_WORDING);
  });

  it("the guard itself catches the phrases it exists for", () => {
    for (const bad of ["Loan approved", "The loan is now active", "Funds will be disbursed", "Disbursement started", "Application rejected"]) {
      expect(bad).toMatch(FORBIDDEN_RECOMMENDATION_WORDING);
    }
  });
});

describe("validateRecommendation", () => {
  it("requires a choice and comments within the backend's limit", () => {
    expect(validateRecommendation("", "x")).toMatch(/Choose/);
    expect(validateRecommendation("recommend_rejection", "  ")).toMatch(/Add your comments/);
    expect(validateRecommendation("recommend_rejection", "x".repeat(2001))).toMatch(/2000/);
    expect(validateRecommendation("recommend_approval", "All checks done.")).toBeNull();
  });
});

describe("RecommendationForm", () => {
  beforeEach(() => {
    submitRecommendation.mockReset();
    replace.mockReset();
  });

  it("shows the checklist state that will be recorded", () => {
    renderForm(incomplete);
    expect(screen.getByText("Checklist: 5 of 7 required checks done")).toBeInTheDocument();
    expect(screen.getByText("Problem found: Valid ID checked")).toBeInTheDocument();
    expect(screen.getByText("Outstanding: Referee checked")).toBeInTheDocument();
    expect(screen.getByText(RECOMMENDATION_COPY.snapshotNote)).toBeInTheDocument();
  });

  it("requires comments, confirms, then sends - recommend language throughout", async () => {
    const user = userEvent.setup();
    submitRecommendation.mockResolvedValue({ ok: true, kind: "recommend_approval" });
    const { container } = renderForm();

    await user.click(screen.getByRole("radio", { name: /Recommend approval/ }));
    await user.click(screen.getByRole("button", { name: "Review and send" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Add your comments/);
    expect(submitRecommendation).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Comments for the administrator/), "ID, employer and referee confirmed.");
    await user.click(screen.getByRole("button", { name: "Review and send" }));
    expect(screen.getByText("Send a recommendation to approve?")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(FORBIDDEN_RECOMMENDATION_WORDING);

    await user.click(screen.getByRole("button", { name: "Send recommendation" }));
    expect(submitRecommendation).toHaveBeenCalledWith(9, "recommend_approval", "ID, employer and referee confirmed.");
    expect(replace).toHaveBeenCalledWith("/staff/applications/9?recommended=recommend_approval", { scroll: true });
  });

  it("blocks recommending approval until the checklist is complete, but allows rejection", async () => {
    const user = userEvent.setup();
    submitRecommendation.mockResolvedValue({ ok: true, kind: "recommend_rejection" });
    renderForm(incomplete);

    await user.click(screen.getByRole("radio", { name: /Recommend approval/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/needs every required check/);
    await user.type(screen.getByLabelText(/Comments for the administrator/), "Can't verify income.");
    await user.click(screen.getByRole("button", { name: "Review and send" }));
    expect(screen.queryByText("Send a recommendation to approve?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Recommend rejection/ }));
    await user.click(screen.getByRole("button", { name: "Review and send" }));
    await user.click(screen.getByRole("button", { name: "Send recommendation" }));
    expect(submitRecommendation).toHaveBeenCalledWith(9, "recommend_rejection", "Can't verify income.");
  });

  it("shows a backend refusal and goes back to editing", async () => {
    const user = userEvent.setup();
    submitRecommendation.mockResolvedValue({ ok: false, error: "This application isn't under review any more. Refresh to see where it is." });
    renderForm();
    await user.click(screen.getByRole("radio", { name: /Recommend rejection/ }));
    await user.type(screen.getByLabelText(/Comments for the administrator/), "No.");
    await user.click(screen.getByRole("button", { name: "Review and send" }));
    await user.click(screen.getByRole("button", { name: "Send recommendation" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/isn't under review any more/);
    expect(screen.getByLabelText(/Comments for the administrator/)).toHaveValue("No.");
  });
});

describe("RecommendationHistoryPanel", () => {
  const rec: ReviewRecommendation = {
    id: 3,
    officer_name: "Olive Officer",
    recommendation: "recommend_approval",
    comments: "All confirmed.",
    created_at: "2026-09-28T00:00:00+00:00",
    checklist_snapshot: [
      { item_type: "valid_id", label: "Valid ID checked", required: true, status: "verified", note: "NID ok" },
      { item_type: "employment", label: "Employment checked", required: true, status: "not_applicable", note: "Self-employed" },
      { item_type: "proof_of_income", label: "Proof of income checked", required: false, status: "pending", note: null },
    ],
  };

  it("shows each recommendation with the checklist as it was when sent, and any return", () => {
    const { container } = render(
      <RecommendationHistoryPanel
        recommendations={[rec]}
        adminReturns={[{ id: 1, recommendation_id: 3, returned_by_name: "Ada Admin", reason: "Re-check the referee.", created_at: null }]}
      />,
    );
    expect(screen.getByText("Recommended approval")).toBeInTheDocument();
    expect(screen.getByText("Checklist when sent: 2 of 2 required checks done")).toBeInTheDocument();
    expect(screen.getByText('Valid ID checked: Verified - "NID ok"')).toBeInTheDocument();
    expect(screen.getByText(/Returned by Ada Admin/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(FORBIDDEN_RECOMMENDATION_WORDING);
  });

  it("renders nothing when there are no recommendations", () => {
    const { container } = render(<RecommendationHistoryPanel recommendations={[]} adminReturns={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
