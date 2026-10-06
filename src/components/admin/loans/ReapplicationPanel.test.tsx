import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const clearReapplicationBlock = vi.fn();
vi.mock("@/lib/actions/admin-reapplication", () => ({
  clearReapplicationBlock: (...a: unknown[]) => clearReapplicationBlock(...a),
}));

import { ReapplicationPanel } from "./ReapplicationPanel";

const blocked = { blocked: true, cleared_at: null, cleared_by_name: null, reason: null };

describe("ReapplicationPanel", () => {
  beforeEach(() => {
    // Block bodies on purpose - see the dashboard test.
    replace.mockReset();
    clearReapplicationBlock.mockReset();
  });

  it("explains the block and needs a reason before clearing", async () => {
    const user = userEvent.setup();
    render(<ReapplicationPanel loanId={5} reapplication={blocked} />);
    expect(screen.getByText(/can't apply for a new PRIME loan until you clear them/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear to apply again" }));
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    expect(screen.getByLabelText(/Why can they apply again/)).toBeRequired();
  });

  it("confirms, then clears once even on a double-click", async () => {
    let resolve!: (v: unknown) => void;
    clearReapplicationBlock.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<ReapplicationPanel loanId={5} reapplication={blocked} />);
    await user.click(screen.getByRole("button", { name: "Clear to apply again" }));
    await user.type(screen.getByLabelText(/Why can they apply again/), "Settled with the member.");
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument();
    const go = screen.getByRole("button", { name: "Clear to apply again" });
    fireEvent.click(go);
    fireEvent.click(go);
    expect(clearReapplicationBlock).toHaveBeenCalledTimes(1);
    expect(clearReapplicationBlock).toHaveBeenCalledWith(5, "Settled with the member.");
    resolve({ ok: true });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/loans/5?cleared=1", { scroll: true }));
  });

  it("shows who cleared it and why, with no action", () => {
    render(
      <ReapplicationPanel
        loanId={5}
        reapplication={{ blocked: false, cleared_at: "2026-10-06T00:00:00+00:00", cleared_by_name: "Ada Admin", reason: "Settled." }}
      />,
    );
    expect(screen.getByText(/Cleared to apply again on Oct 6, 2026/)).toHaveTextContent("by Ada Admin");
    expect(screen.getByText("“Settled.”")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
