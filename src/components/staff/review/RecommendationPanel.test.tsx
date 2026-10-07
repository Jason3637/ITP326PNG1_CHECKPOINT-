import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewAdminReturn, ReviewRecommendation } from "@/lib/types";

const submitRecommendation = vi.fn();
const replace = vi.fn();
vi.mock("@/lib/actions/recommendations", () => ({ submitRecommendation: (...a: unknown[]) => submitRecommendation(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

import { RecommendationForm, type ChecklistState } from "./RecommendationForm";
import { ReturnedBanner, pendingReturn } from "./workspace/ReturnedBanner";
import { TAB_SELECT_EVENT } from "@/components/ui/Tabs";
import { FORBIDDEN_RECOMMENDATION_WORDING } from "@/lib/recommendations";

const incomplete: ChecklistState = {
  started: true,
  required: 7,
  requiredComplete: 4,
  outstanding: ["Referee checked", "Employment checked"],
  failed: ["Valid ID checked"],
  ready: false,
  notApplicable: 1,
};
const complete: ChecklistState = { started: true, required: 7, requiredComplete: 7, outstanding: [], failed: [], ready: true, notApplicable: 2 };

function renderPanel(props: Partial<Parameters<typeof RecommendationForm>[0]> = {}) {
  return render(
    <RecommendationForm
      applicationId={9}
      customerName="Rose Hela"
      checklist={complete}
      requests={{ rounds: 0, open: 0 }}
      canRecommendApproval
      canRecommendRejection
      {...props}
    />,
  );
}
const dialog = () => document.querySelector("dialog")!;

describe("recommendation panel", () => {
  beforeEach(() => {
    submitRecommendation.mockReset();
    replace.mockReset();
  });

  it("summarises what will be recorded, from the data it's given", async () => {
    const onSelect = vi.fn();
    window.addEventListener(TAB_SELECT_EVENT, onSelect);
    renderPanel({ checklist: incomplete, requests: { rounds: 2, open: 0 } });
    const summary = within(screen.getByRole("region", { name: "Review summary" }));
    expect(summary.getByText("Checklist: 4 of 7 required checks done")).toBeInTheDocument();
    expect(summary.getByText("Problems").nextElementSibling).toHaveTextContent("1 problem");
    expect(summary.getByText("Not applicable").nextElementSibling).toHaveTextContent("1 N/A");
    expect(summary.getByText("Information requests").nextElementSibling).toHaveTextContent("All answered (2 rounds)");
    expect(summary.getByText("Problem found: Valid ID checked")).toBeInTheDocument();
    expect(summary.getByText("Outstanding: Referee checked, Employment checked")).toBeInTheDocument();
    await userEvent.click(summary.getByRole("link", { name: "3 checks to look at" }));
    expect((onSelect.mock.calls[0][0] as CustomEvent).detail).toEqual({ tab: "verification" });
    window.removeEventListener(TAB_SELECT_EVENT, onSelect);
  });

  it("says when requests are still open, or none were made", () => {
    const { unmount } = renderPanel({ requests: { rounds: 1, open: 2 } });
    expect(screen.getByText("2 open - waiting on the customer")).toBeInTheDocument();
    unmount();
    renderPanel();
    expect(screen.getByText("No information requested")).toBeInTheDocument();
  });

  it("offers the choice as a fieldset of radios, in recommend-only words", () => {
    renderPanel();
    const group = screen.getByRole("group", { name: "Your recommendation" });
    expect(within(group).getAllByRole("radio").map((r) => r.closest("label")!.textContent)).toEqual([
      expect.stringMatching(/^Recommend approval/),
      expect.stringMatching(/^Recommend rejection/),
    ]);
    expect(document.body.textContent).not.toMatch(/Approve loan|Reject loan/i);
  });

  it("confirms in a dialog with exactly what's being sent, then sends the same payload as before", async () => {
    const user = userEvent.setup();
    submitRecommendation.mockResolvedValue({ ok: true, kind: "recommend_rejection" });
    renderPanel({ checklist: incomplete });
    await user.click(screen.getByRole("radio", { name: /Recommend rejection/ }));
    await user.type(screen.getByLabelText(/Comments for the administrator/), "Income can't be verified.\nReferee unreachable.");
    await user.click(screen.getByRole("button", { name: "Review and send" }));

    const d = screen.getByRole("dialog", { name: "Send a recommendation to reject?" });
    expect(d).toHaveAccessibleDescription(/can't change the recommendation afterwards/);
    const rows = Object.fromEntries(
      within(d).getAllByRole("term").map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
    );
    expect(rows).toEqual({
      Application: "#9 · Rose Hela",
      Recommendation: "Recommend rejection",
      "Required checks": "4 / 7 complete",
      Problems: "Valid ID checked",
      "Your comments": "Income can't be verified.\nReferee unreachable.",
    });
    expect(d.textContent).not.toMatch(FORBIDDEN_RECOMMENDATION_WORDING);

    await user.click(within(d).getByRole("button", { name: "Send to Administrator" }));
    expect(submitRecommendation).toHaveBeenCalledWith(9, "recommend_rejection", "Income can't be verified.\nReferee unreachable.");
    expect(replace).toHaveBeenCalledWith("/staff/applications/9?recommended=recommend_rejection", { scroll: true });
  });

  it("goes Back to editing with everything kept", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("radio", { name: /Recommend approval/ }));
    await user.type(screen.getByLabelText(/Comments for the administrator/), "All confirmed.");
    await user.click(screen.getByRole("button", { name: "Review and send" }));
    await user.click(within(dialog()).getByRole("button", { name: "Back" }));
    expect(dialog()).not.toHaveAttribute("open");
    expect(screen.getByRole("radio", { name: /Recommend approval/ })).toBeChecked();
    expect(screen.getByLabelText(/Comments for the administrator/)).toHaveValue("All confirmed.");
    expect(submitRecommendation).not.toHaveBeenCalled();
  });

  it("sends once however fast it's clicked, and can't be closed while sending", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    submitRecommendation.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPanel();
    await user.click(screen.getByRole("radio", { name: /Recommend approval/ }));
    await user.type(screen.getByLabelText(/Comments for the administrator/), "All confirmed.");
    await user.click(screen.getByRole("button", { name: "Review and send" }));
    const send = within(dialog()).getByRole("button", { name: "Send to Administrator" });
    act(() => {
      send.click();
      send.click();
    });
    expect(submitRecommendation).toHaveBeenCalledTimes(1);
    expect(send).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: "Back" })).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: "Close" })).toBeDisabled();
    await act(async () => resolve({ ok: true, kind: "recommend_approval" }));
    expect(submitRecommendation).toHaveBeenCalledTimes(1);
  });

  it("says when the server can't be reached, keeps the comments and lets the officer send again", async () => {
    const user = userEvent.setup();
    submitRecommendation.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, kind: "recommend_rejection" });
    renderPanel();
    await user.click(screen.getByRole("radio", { name: /Recommend rejection/ }));
    await user.type(screen.getByLabelText(/Comments for the administrator/), "Not affordable.");
    await user.click(screen.getByRole("button", { name: "Review and send" }));
    await user.click(within(dialog()).getByRole("button", { name: "Send to Administrator" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
    expect(dialog()).not.toHaveAttribute("open");
    expect(screen.getByLabelText(/Comments for the administrator/)).toHaveValue("Not affordable.");

    await user.click(screen.getByRole("button", { name: "Review and send" }));
    await user.click(within(dialog()).getByRole("button", { name: "Send to Administrator" }));
    expect(submitRecommendation).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("shows the administrator's return in the panel, for the new recommendation", () => {
    renderPanel({ returned: { by: "Ada Admin", at: "Sep 27, 2026, 10:00 AM", reason: "Explain the late repayment." } });
    expect(screen.getByText("Returned by Ada Admin · Sep 27, 2026, 10:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Explain the late repayment.")).toBeInTheDocument();
  });
});

describe("returned-for-review banner", () => {
  const rec = (id: number, created_at: string): ReviewRecommendation =>
    ({ id, officer_name: "Olive Officer", recommendation: "recommend_approval", comments: "c", checklist_snapshot: [], created_at }) as ReviewRecommendation;
  const ret: ReviewAdminReturn = { id: 1, recommendation_id: 3, returned_by_name: "Ada Admin", reason: "Explain the late repayment.", created_at: "2026-09-27T00:00:00Z" };

  it("is pending from the return until a newer recommendation is sent", () => {
    expect(pendingReturn("returned_to_officer", [ret], [rec(3, "2026-09-26T00:00:00Z")])).toBe(ret);
    expect(pendingReturn("officer_review", [ret], [rec(3, "2026-09-26T00:00:00Z")])).toBe(ret);
    expect(pendingReturn("recommended_for_approval", [ret], [rec(3, "2026-09-26T00:00:00Z"), rec(4, "2026-09-28T00:00:00Z")])).toBeNull();
    expect(pendingReturn("officer_review", [], [])).toBeNull();
  });

  it("names who returned it, why, and what to do next", () => {
    const { container } = render(<ReturnedBanner status="returned_to_officer" adminReturns={[ret]} recommendations={[rec(3, "2026-09-26T00:00:00Z")]} />);
    const banner = container.querySelector("[data-workflow-banner=returned]")!;
    expect(banner).toHaveTextContent(/^Returned by Ada Admin · Sep 27, 2026/);
    expect(banner).toHaveTextContent("Explain the late repayment.");
    expect(banner).toHaveTextContent("This was about the recommended approval by Olive Officer.");
    expect(banner).toHaveTextContent("Resume the review to update the checks and send a new recommendation.");
  });
});
