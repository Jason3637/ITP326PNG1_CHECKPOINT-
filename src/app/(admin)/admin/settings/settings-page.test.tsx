import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
const params = {
  parameters: {
    min_monthly_income: { value: 200, type: "money", description: "Minimum self-reported monthly income ...", source: "default", updated_at: null, updated_by: null },
    max_debt_to_income_ratio: { value: 0.4, type: "rate", description: "Max (existing debt + new installment) / income ...", source: "override", updated_at: "2026-10-01T00:00:00+00:00", updated_by: 99 },
    customer_verification_validity_months: { value: 12, type: "int", description: "Months ... 12 is an engineering default ...", source: "default", updated_at: null, updated_by: null },
  },
};

const renderPage = async (search: Record<string, string> = {}) =>
  render(await AdminSettingsPage({ searchParams: Promise.resolve(search) }));

describe("Parameter management", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
    serverApiFetch.mockImplementation(async (path: string) =>
      path === "/admin/pricing" ? pricing : path === "/admin/penalty-policy" ? penalty : params,
    );
  });

  it("warns plainly that changes only affect new applications, never existing loans", async () => {
    await renderPage();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Changes affect new applications only - never existing loans");
    expect(note).toHaveTextContent("existing loans keep their terms and penalty policy");
  });

  it("keeps the warning in plain sight: no hover, no collapsed section, ahead of every editor", async () => {
    await renderPage();
    const note = screen.getByRole("note");
    expect(note).toBeVisible();
    // Nothing to open or hover - the same for mouse, keyboard, touch and screen readers.
    expect(note.closest("details, [hidden], [role=tooltip], dialog")).toBeNull();
    expect(note.querySelector("button, a, [tabindex]")).toBeNull();
    // Read before any way to change a setting.
    const firstEditor = screen.getByRole("button", { name: "Change PRIME pricing" });
    expect(note.compareDocumentPosition(firstEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("puts name, value and a short explanation first; the longer one opens on request", async () => {
    await renderPage();
    const row = screen.getByText("Maximum debt-to-income", { selector: "dt" }).closest("div.flex") as HTMLElement;
    expect(within(row).getByText(/never approves or rejects anything/)).toBeVisible();
    const more = within(row).getByText("How it's used");
    const details = more.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    // A native <summary>: browsers make it focusable and open it with
    // Enter/Space, by click and by tap (jsdom only simulates the click).
    expect(more.tagName).toBe("SUMMARY");
    await userEvent.click(more);
    expect(details.open).toBe(true);
    expect(within(details).getByText(/as a share of monthly income/)).toBeVisible();
  });

  it("opens the settings editor from the page", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Change these settings" }));
    expect(screen.getByRole("heading", { name: "Change settings" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Minimum monthly income/ })).toHaveValue("200");
  });

  it("shows the limited set: PRIME pricing, late penalties and the three live settings", async () => {
    await renderPage();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      expect.arrayContaining(["PRIME pricing", "Late penalties", "Credit notes & verification"]),
    );
    expect(serverApiFetch.mock.calls.map((c) => c[0]).sort()).toEqual(["/admin/parameters", "/admin/penalty-policy", "/admin/pricing"]);
  });

  it("shows each live setting in plain words, with what a change affects", async () => {
    const { container } = await renderPage();
    const row = (label: string) => screen.getByText(label, { selector: "dt" }).closest("div.flex") as HTMLElement;
    expect(row("Minimum monthly income")).toHaveTextContent("K200");
    expect(row("Minimum monthly income")).toHaveTextContent("never approves or rejects anything");
    expect(row("Maximum debt-to-income")).toHaveTextContent("40%");
    expect(row("Maximum debt-to-income")).toHaveTextContent("Changed Oct 1, 2026");
    expect(row("Customer verification lasts")).toHaveTextContent("12 months");
    expect(row("Customer verification lasts")).toHaveTextContent("still to be confirmed by PRIMESTONE");
    expect(row("Customer verification lasts")).toHaveTextContent("existing verifications keep their expiry date");
    expect(container.textContent).not.toMatch(/min_monthly_income|max_debt_to_income_ratio|engineering default/);
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

  it("offers an editor for each table and for the settings", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: "Change PRIME pricing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change late penalties" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change these settings" })).toBeInTheDocument();
  });

  it("confirms a settings save", async () => {
    await renderPage({ saved: "parameters" });
    expect(screen.getByRole("status")).toHaveTextContent("Settings saved. They apply from now on.");
  });
});
