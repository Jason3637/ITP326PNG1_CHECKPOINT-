import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const decideApplication = vi.fn();
vi.mock("@/lib/actions/admin-decisions", () => ({
  decideApplication: (...a: unknown[]) => decideApplication(...a),
}));

import { FinalDecisionPanel } from "./FinalDecisionPanel";

const all = { applicationId: 8, canApprove: true, canReject: true, canReturn: true };

describe("FinalDecisionPanel", () => {
  beforeEach(() => {
    // Block bodies on purpose - see the dashboard test.
    replace.mockReset();
    decideApplication.mockReset();
  });

  it("offers exactly the three actions, and nothing to edit the amount or term", () => {
    render(<FinalDecisionPanel {...all} latestRecommendation="recommend_approval" />);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^Approve/),
      expect.stringMatching(/^Reject/),
      expect.stringMatching(/^Return to Loan Officer/),
    ]);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/amount|term/i)).not.toBeInTheDocument();
  });

  it("shows only the actions the backend allows", () => {
    render(<FinalDecisionPanel {...all} canApprove={false} canReturn={false} latestRecommendation={null} />);
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: /Reject/ })).toBeInTheDocument();
  });

  it("renders nothing when no action is allowed", () => {
    const { container } = render(
      <FinalDecisionPanel applicationId={8} canApprove={false} canReject={false} canReturn={false} latestRecommendation={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("won't let a rejection go forward without a reason", async () => {
    const user = userEvent.setup();
    render(<FinalDecisionPanel {...all} latestRecommendation="recommend_approval" />);
    await user.click(screen.getByRole("radio", { name: /Reject/ }));
    const next = screen.getByRole("button", { name: "Review decision" });
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason for rejecting/), "   ");
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason for rejecting/), "Income unverified.");
    expect(next).toBeEnabled();
    await user.click(next);
    expect(screen.getByText("Reject this application?")).toBeInTheDocument();
    expect(screen.getByText("Income unverified.")).toBeInTheDocument();
    expect(decideApplication).not.toHaveBeenCalled();
  });

  it("needs a reason to return to the loan officer", async () => {
    const user = userEvent.setup();
    render(<FinalDecisionPanel {...all} latestRecommendation="recommend_approval" />);
    await user.click(screen.getByRole("radio", { name: /Return to Loan Officer/ }));
    expect(screen.getByRole("button", { name: "Review decision" })).toBeDisabled();
    expect(screen.getByLabelText(/What should the loan officer look at/)).toBeRequired();
  });

  it("asks no reason to approve in line with the officer, and says the loan isn't active yet", async () => {
    decideApplication.mockResolvedValue({ ok: true, outcome: "approved" });
    const user = userEvent.setup();
    render(<FinalDecisionPanel {...all} latestRecommendation="recommend_approval" />);
    await user.click(screen.getByRole("radio", { name: /Approve/ }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review decision" }));
    const confirm = screen.getByText("Approve this application?").parentElement!;
    expect(confirm).toHaveTextContent("Approved — Awaiting Disbursement");
    expect(confirm).toHaveTextContent("No loan is created and no money moves yet");
    await user.click(screen.getByRole("button", { name: "Approve application" }));
    expect(decideApplication).toHaveBeenCalledWith(8, "approve", "", "recommend_approval");
    expect(replace).toHaveBeenCalledWith("/admin/applications/8?decided=approved", { scroll: true });
  });

  it("requires a note to approve against a recommendation to reject", async () => {
    const user = userEvent.setup();
    render(<FinalDecisionPanel {...all} latestRecommendation="recommend_rejection" />);
    await user.click(screen.getByRole("radio", { name: /Approve/ }));
    expect(screen.getByLabelText(/Why are you approving against the officer's recommendation/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review decision" })).toBeDisabled();
  });

  it("shows the backend's refusal and stays on the form", async () => {
    decideApplication.mockResolvedValue({ ok: false, error: "This application isn't waiting on a final decision any more." });
    const user = userEvent.setup();
    render(<FinalDecisionPanel {...all} latestRecommendation="recommend_approval" />);
    await user.click(screen.getByRole("radio", { name: /Approve/ }));
    await user.click(screen.getByRole("button", { name: "Review decision" }));
    await user.click(screen.getByRole("button", { name: "Approve application" }));
    expect(screen.getByRole("alert")).toHaveTextContent("isn't waiting on a final decision");
    expect(replace).not.toHaveBeenCalled();
  });
});
