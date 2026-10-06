import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const writeOffLoan = vi.fn();
vi.mock("@/lib/actions/admin-write-off", () => ({ writeOffLoan: (...a: unknown[]) => writeOffLoan(...a) }));

import { WriteOffPanel } from "./WriteOffPanel";

describe("WriteOffPanel", () => {
  beforeEach(() => {
    // Block bodies on purpose - see the dashboard test.
    replace.mockReset();
    writeOffLoan.mockReset();
  });

  it("needs a reason, confirms what happens, then writes off once", async () => {
    let resolve!: (v: unknown) => void;
    writeOffLoan.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<WriteOffPanel loanId={5} outstanding={600} />);
    await user.click(screen.getByRole("button", { name: "Write off this loan" }));
    expect(screen.getByRole("button", { name: "Review write-off" })).toBeDisabled();
    await user.type(screen.getByLabelText(/Why is it being written off/), "Unreachable for 60 days.");
    await user.click(screen.getByRole("button", { name: "Review write-off" }));
    expect(screen.getByText("It closes as written off with K600 still owed.")).toBeInTheDocument();
    expect(screen.getByText(/can't apply for a new PRIME loan until you clear them/)).toBeInTheDocument();
    const go = screen.getByRole("button", { name: "Write off loan" });
    fireEvent.click(go);
    fireEvent.click(go);
    expect(writeOffLoan).toHaveBeenCalledTimes(1);
    expect(writeOffLoan).toHaveBeenCalledWith(5, "Unreachable for 60 days.");
    resolve({ ok: true });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/loans/5?written_off=1", { scroll: true }));
  });

  it("shows the backend's refusal and unlocks", async () => {
    writeOffLoan.mockResolvedValue({ ok: false, error: "This loan is already closed. Refresh to see its current state." });
    const user = userEvent.setup();
    render(<WriteOffPanel loanId={5} outstanding={600} />);
    await user.click(screen.getByRole("button", { name: "Write off this loan" }));
    await user.type(screen.getByLabelText(/Why is it being written off/), "x");
    await user.click(screen.getByRole("button", { name: "Review write-off" }));
    await user.click(screen.getByRole("button", { name: "Write off loan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already closed");
    expect(replace).not.toHaveBeenCalled();
  });
});
