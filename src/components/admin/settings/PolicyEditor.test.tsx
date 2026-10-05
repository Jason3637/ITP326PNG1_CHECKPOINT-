import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const savePricing = vi.fn();
const savePenaltyPolicy = vi.fn();
vi.mock("@/lib/actions/admin-settings", () => ({
  savePricing: (...a: unknown[]) => savePricing(...a),
  savePenaltyPolicy: (...a: unknown[]) => savePenaltyPolicy(...a),
}));

import { PolicyEditor } from "./PolicyEditor";

const rows = [
  { category: "PRIME 1", min: "100", max: "300", ratePct: "50" },
  { category: "PRIME 2", min: "301", max: "1000", ratePct: "40" },
];

async function open() {
  const user = userEvent.setup();
  render(<PolicyEditor kind="pricing" title="New PRIME pricing" description="d" currentLabel="prime-v1" initialRows={rows} />);
  await user.click(screen.getByRole("button", { name: "Change PRIME pricing" }));
  return user;
}

describe("PolicyEditor", () => {
  beforeEach(() => {
    // Block bodies on purpose - see the dashboard test.
    replace.mockReset();
    savePricing.mockReset();
    savePenaltyPolicy.mockReset();
  });

  it("starts closed, and needs a real change before review", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Review change" })).toBeDisabled();
    expect(screen.getByLabelText("Tier 1 Category")).toHaveValue("PRIME 1");
  });

  it("shows problems as they're typed and blocks review", async () => {
    const user = await open();
    const min = screen.getByLabelText("Tier 2 From (K)");
    await user.clear(min);
    await user.type(min, "350");
    expect(screen.getByText(/PRIME 2 must start at K301/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review change" })).toBeDisabled();
  });

  it("confirms it's a new version for new applications, then saves once", async () => {
    let resolve!: (v: unknown) => void;
    savePricing.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = await open();
    const rate = screen.getByLabelText("Tier 2 Interest (flat, %)");
    await user.clear(rate);
    await user.type(rate, "38");
    await user.click(screen.getByRole("button", { name: "Review change" }));
    expect(screen.getByText(/replaces prime-v1 for applications submitted from now on/)).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save new version" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(savePricing).toHaveBeenCalledTimes(1);
    expect(savePricing.mock.calls[0][0][1]).toEqual({ category: "PRIME 2", min: "301", max: "1000", ratePct: "38" });
    resolve({ ok: true, label: "prime-v2" });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/settings?saved=pricing", { scroll: true }));
  });

  it("adds and removes tiers within the limits", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Add a tier" }));
    expect(screen.getByLabelText("Tier 3 Category")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Remove tier 3" }));
    expect(screen.queryByLabelText("Tier 3 Category")).not.toBeInTheDocument();
  });

  it("shows the backend's refusal and stays open", async () => {
    savePricing.mockResolvedValue({ ok: false, error: "Tier 1: amounts must be whole Kina." });
    const user = await open();
    await user.type(screen.getByLabelText("Tier 1 Category"), "A");
    await user.click(screen.getByRole("button", { name: "Review change" }));
    await user.click(screen.getByRole("button", { name: "Save new version" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("whole Kina");
    expect(replace).not.toHaveBeenCalled();
  });
});
