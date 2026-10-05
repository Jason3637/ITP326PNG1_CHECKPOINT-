import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const saveParameters = vi.fn();
vi.mock("@/lib/actions/admin-settings", () => ({ saveParameters: (...a: unknown[]) => saveParameters(...a) }));

import { ParametersEditor } from "./ParametersEditor";

const initial = { min_monthly_income: 200, max_debt_to_income_ratio: 0.4, customer_verification_validity_months: 12 };

async function open() {
  const user = userEvent.setup();
  render(<ParametersEditor initial={initial} />);
  await user.click(screen.getByRole("button", { name: "Change these settings" }));
  return user;
}

describe("ParametersEditor", () => {
  beforeEach(() => {
    // Block bodies on purpose - see the dashboard test.
    replace.mockReset();
    saveParameters.mockReset();
  });

  it("shows the values in the admin's units and needs a change before review", async () => {
    await open();
    expect(screen.getByLabelText(/Maximum debt-to-income/)).toHaveValue("40");
    expect(screen.getByRole("button", { name: "Review change" })).toBeDisabled();
  });

  it("flags an invalid value and blocks review", async () => {
    const user = await open();
    const months = screen.getByLabelText(/Customer verification lasts/);
    await user.clear(months);
    await user.type(months, "0");
    expect(screen.getByText(/at least 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review change" })).toBeDisabled();
  });

  it("confirms the before and after, then saves only what changed, once", async () => {
    let resolve!: (v: unknown) => void;
    saveParameters.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = await open();
    const dti = screen.getByLabelText(/Maximum debt-to-income/);
    await user.clear(dti);
    await user.type(dti, "35");
    await user.click(screen.getByRole("button", { name: "Review change" }));
    expect(screen.getByText("Maximum debt-to-income: 40% → 35 %")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(saveParameters).toHaveBeenCalledTimes(1);
    expect(saveParameters).toHaveBeenCalledWith({ max_debt_to_income_ratio: "35" });
    resolve({ ok: true, label: "settings" });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/settings?saved=parameters", { scroll: true }));
  });
});
