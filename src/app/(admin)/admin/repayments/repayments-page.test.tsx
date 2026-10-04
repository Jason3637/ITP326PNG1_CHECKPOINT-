import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { repaymentItem } from "@/components/admin/admin-fixtures.test-utils";

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

import AdminRepaymentsPage from "./page";

const page = (items: unknown[], total = items.length, status = "awaiting") => ({ status, page: 1, per_page: 25, total, items });
const renderList = async (search: Record<string, string> = {}) =>
  render(await AdminRepaymentsPage({ searchParams: Promise.resolve(search) }));

describe("Repayment Verification queue", () => {
  beforeEach(() => {
    // Block body on purpose - see the loan page test.
    serverApiFetch.mockReset();
  });

  it("lists awaiting payments with every column the queue needs", async () => {
    serverApiFetch.mockResolvedValue(page([repaymentItem(12, { receipts: [{ id: 40 }, { id: 41 }] })]));
    await renderList();
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/repayments?status=awaiting&page=1&per_page=25");
    const row = screen.getByRole("link", { name: "Payment #12" }).closest("li") as HTMLElement;
    expect(screen.getByRole("link", { name: "Payment #12" })).toHaveAttribute("href", "/admin/loans/30/repayments/12");
    expect(within(row).getByRole("link", { name: "Loan #30" })).toHaveAttribute("href", "/admin/loans/30");
    for (const t of ["Payer Person", "K200", "Oct 3, 2026", "BSP Mobile Banking", "Ref BSP-123", "K250", "Awaiting verification"]) {
      expect(row).toHaveTextContent(t);
    }
    expect(within(row).getByRole("button", { name: "Receipt 1" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Receipt 2" })).toBeInTheDocument();
  });

  it("filters by status from the URL", async () => {
    serverApiFetch.mockResolvedValue(page([], 0, "verified"));
    await renderList({ status: "verified" });
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/repayments?status=verified&page=1&per_page=25");
    expect(screen.getByRole("link", { name: "Verified" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("No verified repayments yet.")).toBeInTheDocument();
  });

  it("falls back to awaiting for an unknown filter", async () => {
    serverApiFetch.mockResolvedValue(page([]));
    await renderList({ status: "everything" });
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/repayments?status=awaiting&page=1&per_page=25");
  });
});
