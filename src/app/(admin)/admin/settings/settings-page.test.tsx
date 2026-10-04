import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import AdminSettingsPage from "./page";

const v = (id: number, label: string, tiers: unknown[], current: boolean, note: string | null = null) => ({
  id, label, note, created_at: "2026-09-01T00:00:00+00:00", created_by: 99, is_current: current, tiers,
});
const pricing = {
  current: v(2, "prime-v2", [
    { category: "PRIME 1", min_amount: 100, max_amount: 300, interest_rate: 0.5 },
    { category: "PRIME 2", min_amount: 301, max_amount: 1000, interest_rate: 0.4 },
  ], true, "Rates review."),
  history: [] as unknown[],
  applies_to: "Applications submitted after a version is created. Existing quotes, and the terms snapshot of every disbursed loan, never change.",
};
pricing.history = [pricing.current, v(1, "prime-v1", [{ category: "PRIME 1", min_amount: 100, max_amount: 1000, interest_rate: 0.45 }], false)];
const penalty = {
  current: v(1, "penalty-v1", [{ tier: 1, days_late: 7, pct_of_original_interest: 0.25 }, { tier: 2, days_late: 14, pct_of_original_interest: 1 }], true),
  history: [] as unknown[],
  applies_to: pricing.applies_to,
};
penalty.history = [penalty.current];

const renderPage = async (search: Record<string, string> = {}) =>
  render(await AdminSettingsPage({ searchParams: Promise.resolve(search) }));

describe("Parameter management", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
    serverApiFetch.mockImplementation(async (path: string) => (path === "/admin/pricing" ? pricing : penalty));
  });

  it("warns plainly that changes only affect new applications, never existing loans", async () => {
    await renderPage();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Changes affect new applications only - never existing loans");
    expect(note).toHaveTextContent("existing loans keep their terms and penalty policy");
  });

  it("shows only the limited, versioned settings: PRIME pricing and late penalties", async () => {
    await renderPage();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      expect.arrayContaining(["PRIME pricing", "Late penalties"]),
    );
    expect(screen.queryByText(/min_monthly_income|debt_to_income|verification_validity/i)).not.toBeInTheDocument();
    expect(serverApiFetch.mock.calls.map((c) => c[0]).sort()).toEqual(["/admin/penalty-policy", "/admin/pricing"]);
  });

  it("shows the current tables and earlier versions", async () => {
    await renderPage();
    const row = screen.getByRole("cell", { name: "PRIME 2" }).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("K301 – K1,000");
    expect(row).toHaveTextContent("40%");
    expect(screen.getByText(/14 days late/)).toBeInTheDocument();
    expect(screen.getByText("100% of the original interest")).toBeInTheDocument();
    expect(screen.getByText("Earlier versions (1)")).toBeInTheDocument();
    expect(screen.getByText(/PRIME 1 K100–K1,000 at 45%/)).toBeInTheDocument();
    expect(screen.queryByText(/\b99\b/)).not.toBeInTheDocument(); // created_by id
  });

  it("confirms a save only for the kind that was saved", async () => {
    await renderPage({ saved: "pricing" });
    expect(screen.getByRole("status")).toHaveTextContent("Saved as prime-v2. It applies to applications submitted from now on.");
  });

  it("offers an editor for each table", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: "Change PRIME pricing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change late penalties" })).toBeInTheDocument();
  });
});
