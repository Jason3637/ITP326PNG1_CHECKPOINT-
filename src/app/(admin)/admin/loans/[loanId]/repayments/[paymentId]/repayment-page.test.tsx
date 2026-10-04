import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { loanDetail } from "@/components/admin/admin-fixtures.test-utils";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import AdminRepaymentPage from "./page";

const renderPayment = async (paymentId: string, search: Record<string, string> = {}, loanId = "5") =>
  render(
    await AdminRepaymentPage({
      params: Promise.resolve({ loanId, paymentId }),
      searchParams: Promise.resolve(search),
    }),
  );

describe("Repayment Verification workspace", () => {
  beforeEach(() => {
    // Block body on purpose - see the loan page test.
    serverApiFetch.mockReset();
  });

  it("shows the reported payment and the loan's current outstanding", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await renderPayment("4");
    const card = screen.getByRole("heading", { name: "Reported payment" }).closest("div.rounded-xl") as HTMLElement;
    for (const t of ["#4", "#5", "Simon Ere", "K200", "Oct 3, 2026", "Cash", "Not given", "None attached", "Loan Overdue", "K600"]) {
      expect(card).toHaveTextContent(t);
    }
    expect(screen.getAllByRole("radio")).toHaveLength(2); // reported -> actions open
  });

  it("disables Verify and Reject for a payment that's already verified", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await renderPayment("3");
    expect(screen.getByRole("button", { name: "Verify payment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject payment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "View receipt" })).toBeInTheDocument();
  });

  it("confirms a verification only when the backend shows it verified", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await renderPayment("3", { done: "verified" });
    expect(screen.getByRole("status")).toHaveTextContent("Loan #5 now has K600 outstanding.");
  });

  it("ignores ?done=verified for a payment that isn't verified", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await renderPayment("4", { done: "verified" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says the loan closed when the verification paid it off", async () => {
    serverApiFetch.mockResolvedValue(loanDetail({ status: "closed", closure: { closure_reason: "paid_in_full" } }));
    await renderPayment("3", { done: "verified" });
    expect(screen.getByRole("status")).toHaveTextContent("Loan #5 is paid in full and closed.");
  });

  it("404s for a payment that isn't on this loan", async () => {
    serverApiFetch.mockResolvedValue(loanDetail());
    await expect(renderPayment("77")).rejects.toThrow("NOT_FOUND");
    await expect(renderPayment("x")).rejects.toThrow("NOT_FOUND");
  });
});
