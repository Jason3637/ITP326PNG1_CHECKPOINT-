import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BasicDetailsStep } from "./BasicDetailsStep";
import { getPrimePreview } from "@/lib/actions/prime-pricing";
import type { Profile } from "@/lib/types";

vi.mock("@/lib/actions/prime-pricing", () => ({
  getPrimePreview: vi.fn(),
}));

const mockedPreview = vi.mocked(getPrimePreview);

const profile: Profile = {
  id: 1,
  email: "jane@example.com",
  full_name: "Jane Doe",
  phone_number: "+675 7000 0000",
  role: "customer",
  is_active: true,
  totp_enabled: true,
  created_at: "2026-01-01T00:00:00.000Z",
};

function renderStep(amount = "") {
  const onAmountChange = vi.fn();
  const onNext = vi.fn();
  const utils = render(
    <BasicDetailsStep profile={profile} amount={amount} onAmountChange={onAmountChange} onNext={onNext} />,
  );
  return { ...utils, onAmountChange, onNext };
}

beforeEach(() => mockedPreview.mockReset());

describe("BasicDetailsStep — live PRIME preview", () => {
  it("shows an informational prompt before any amount is entered, and never calls the preview", () => {
    renderStep();
    expect(screen.getByText(/Enter an amount to see a live preview/)).toBeInTheDocument();
    expect(mockedPreview).not.toHaveBeenCalled();
  });

  it("calls GET /loans/prime-preview (debounced) and shows the real category/interest/total for a valid amount", async () => {
    mockedPreview.mockResolvedValue({
      ok: true,
      pricing: { category: "PRIME 2", amount: 500, interest_amount: 200, interest_rate: 0.4, total_repayable: 700, term_days: 14 },
    });
    renderStep("500");

    await waitFor(() => expect(mockedPreview).toHaveBeenCalledWith(500), { timeout: 2000 });
    expect(await screen.findByText("PRIME 2 (preview)")).toBeInTheDocument();
    expect(screen.getByText("Interest: K200")).toBeInTheDocument();
    expect(screen.getByText("Total repayable: K700")).toBeInTheDocument();
  });

  it("shows a clean, friendly message for an out-of-range amount - never the raw backend error text", async () => {
    mockedPreview.mockResolvedValue({
      ok: false,
      error: "PRIME loans are available from K100 to K1,000, in whole Kina.",
    });
    renderStep("5000");

    await waitFor(() => expect(mockedPreview).toHaveBeenCalledWith(5000), { timeout: 2000 });
    expect(await screen.findByText("PRIME loans are available from K100 to K1,000, in whole Kina.")).toBeInTheDocument();
    expect(screen.queryByText(/amount_requested/)).not.toBeInTheDocument();
  });

  it("never shows a preview for a zero/blank/invalid amount", async () => {
    renderStep("0");
    await new Promise((r) => setTimeout(r, 500));
    expect(mockedPreview).not.toHaveBeenCalled();
  });
});
