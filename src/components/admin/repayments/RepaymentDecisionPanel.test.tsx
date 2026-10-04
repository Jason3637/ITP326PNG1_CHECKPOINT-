import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const verifyRepayment = vi.fn();
const rejectRepayment = vi.fn();
vi.mock("@/lib/actions/admin-repayments", () => ({
  verifyRepayment: (...a: unknown[]) => verifyRepayment(...a),
  rejectRepayment: (...a: unknown[]) => rejectRepayment(...a),
}));

import { RepaymentDecisionPanel } from "./RepaymentDecisionPanel";

const props = { paymentId: 4, loanId: 5, amount: 200, outstanding: 600 };

describe("RepaymentDecisionPanel", () => {
  beforeEach(() => {
    // Block bodies on purpose - see the dashboard test.
    replace.mockReset();
    verifyRepayment.mockReset();
    rejectRepayment.mockReset();
  });

  it.each(["verified", "rejected"] as const)("disables both actions once the payment is %s", (status) => {
    render(<RepaymentDecisionPanel {...props} status={status} />);
    expect(screen.getByRole("button", { name: "Verify payment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject payment" })).toBeDisabled();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/can't be verified or rejected again/)).toBeInTheDocument();
  });

  it.each(["reported", "verification_pending"] as const)("offers Verify and Reject while %s", (status) => {
    render(<RepaymentDecisionPanel {...props} status={status} />);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("needs a reason to reject", async () => {
    const user = userEvent.setup();
    render(<RepaymentDecisionPanel {...props} status="reported" />);
    await user.click(screen.getByRole("radio", { name: /Reject/ }));
    expect(screen.getByRole("button", { name: "Review decision" })).toBeDisabled();
    expect(screen.getByLabelText(/Reason for rejecting/)).toBeRequired();
    await user.type(screen.getByLabelText(/Reason for rejecting/), "No such transaction.");
    expect(screen.getByRole("button", { name: "Review decision" })).toBeEnabled();
  });

  it("verifies once even on a double-click", async () => {
    let resolve!: (v: unknown) => void;
    verifyRepayment.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<RepaymentDecisionPanel {...props} status="reported" />);
    await user.click(screen.getByRole("radio", { name: /Verify/ }));
    await user.click(screen.getByRole("button", { name: "Review decision" }));
    const confirm = screen.getByRole("button", { name: "Verify payment" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(verifyRepayment).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Verify payment" })).toBeDisabled();
    resolve({ ok: true, decision: "verified" });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/loans/5/repayments/4?done=verified", { scroll: true }));
  });

  it("warns when the payment is more than the outstanding balance", () => {
    render(<RepaymentDecisionPanel {...props} amount={900} status="reported" />);
    expect(screen.getByText(/more than the K600 outstanding/)).toBeInTheDocument();
  });

  it("shows the backend's refusal and unlocks", async () => {
    verifyRepayment.mockResolvedValue({ ok: false, error: "This payment has already been verified or rejected." });
    const user = userEvent.setup();
    render(<RepaymentDecisionPanel {...props} status="reported" />);
    await user.click(screen.getByRole("radio", { name: /Verify/ }));
    await user.click(screen.getByRole("button", { name: "Review decision" }));
    await user.click(screen.getByRole("button", { name: "Verify payment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already been verified");
    expect(replace).not.toHaveBeenCalled();
  });
});
