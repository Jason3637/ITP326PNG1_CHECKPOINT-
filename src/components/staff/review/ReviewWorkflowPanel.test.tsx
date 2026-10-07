import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const claimApplication = vi.fn();
const resumeReview = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/actions/review-workflow", () => ({
  claimApplication: (...a: unknown[]) => claimApplication(...a),
  resumeReview: (...a: unknown[]) => resumeReview(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ReviewWorkflowPanel } from "./ReviewWorkflowPanel";

describe("ReviewWorkflowPanel", () => {
  beforeEach(() => {
    claimApplication.mockReset();
    resumeReview.mockReset();
    refresh.mockReset();
  });

  it("renders nothing when the backend offers neither claim nor resume", () => {
    const { container } = render(<ReviewWorkflowPanel applicationId={1} canClaim={false} canResume={false} status="officer_review" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("claims a new application and refreshes the screen", async () => {
    const user = userEvent.setup();
    claimApplication.mockResolvedValue({ ok: true });
    render(<ReviewWorkflowPanel applicationId={1} canClaim canResume={false} status="submitted" />);
    expect(screen.getByRole("heading", { name: "Start the review" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Claim and start review" }));
    expect(claimApplication).toHaveBeenCalledWith(1);
    expect(refresh).toHaveBeenCalled();
  });

  it("moves focus to the workspace heading once the claim has gone through", async () => {
    const user = userEvent.setup();
    claimApplication.mockResolvedValue({ ok: true });
    const view = render(
      <>
        <h2 id="workspace-heading" tabIndex={-1}>
          Application #1
        </h2>
        <ReviewWorkflowPanel applicationId={1} canClaim canResume={false} status="submitted" focusTargetId="workspace-heading" />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Claim and start review" }));
    // router.refresh() brings the server render that no longer offers the claim.
    view.rerender(
      <>
        <h2 id="workspace-heading" tabIndex={-1}>
          Application #1
        </h2>
        <ReviewWorkflowPanel applicationId={1} canClaim={false} canResume={false} status="officer_review" focusTargetId="workspace-heading" />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Application #1" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Claim and start review" })).not.toBeInTheDocument();
  });

  it("shows why a claim failed and doesn't refresh", async () => {
    const user = userEvent.setup();
    claimApplication.mockResolvedValue({ ok: false, error: "Someone has already claimed this application. Refresh to see who." });
    render(<ReviewWorkflowPanel applicationId={1} canClaim canResume={false} status="submitted" />);
    await user.click(screen.getByRole("button", { name: "Claim and start review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already claimed");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("requires a reason to resume while waiting on the customer (open requests get cancelled)", async () => {
    const user = userEvent.setup();
    resumeReview.mockResolvedValue({ ok: true });
    render(<ReviewWorkflowPanel applicationId={9} canClaim={false} canResume status="customer_action_required" />);
    expect(screen.getByText(/open requests will be cancelled/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume review" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Give a reason/);
    expect(resumeReview).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Reason"), "Customer confirmed by phone.");
    await user.click(screen.getByRole("button", { name: "Resume review" }));
    expect(resumeReview).toHaveBeenCalledWith(9, "Customer confirmed by phone.");
    expect(refresh).toHaveBeenCalled();
  });

  it("resumes a returned application without a reason", async () => {
    const user = userEvent.setup();
    resumeReview.mockResolvedValue({ ok: true });
    render(<ReviewWorkflowPanel applicationId={15} canClaim={false} canResume status="returned_to_officer" />);
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume review" }));
    expect(resumeReview).toHaveBeenCalledWith(15, "");
  });
});
