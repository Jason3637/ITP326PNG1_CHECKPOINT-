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

import AdminAuditLogPage from "./page";
import { ApiError } from "@/lib/server-api";

const entry = (id: number, o: Record<string, unknown> = {}) => ({
  id, actor_id: 7, actor_role: "admin", action: "payment_verified", entity_type: "PaymentTransaction", entity_id: String(id),
  details: { loan_id: 5, amount: 300, storage_path: "users/1/SECRET.pdf" }, ip_address: "10.0.0.4", created_at: "2026-10-05T00:30:00+00:00", ...o,
});
const page = (items: unknown[], o: Record<string, number> = {}) => ({ page: 1, per_page: 50, total: items.length, pages: 1, items, ...o });
const renderPage = async (search: Record<string, string> = {}) =>
  render(await AdminAuditLogPage({ searchParams: Promise.resolve(search) }));

describe("Audit log", () => {
  beforeEach(() => {
    // Block body on purpose - see the settings page test.
    serverApiFetch.mockReset();
  });

  it("lists entries newest first in a table: when, user, role, action, record", async () => {
    serverApiFetch.mockResolvedValue(page([entry(3), entry(2, { action: "prime_pricing_version_created", entity_type: "PrimePricingVersion", details: { before_version: "prime-v1", after_version: "prime-v2" } })]));
    const { container } = await renderPage();
    expect(serverApiFetch).toHaveBeenCalledWith("/reports/audit-logs?page=1&per_page=50");
    const table = screen.getByRole("table", { name: "Audit log entries, newest first" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Date & time", "User", "Role", "Action", "Record", "Details",
    ]);
    const [first, second] = within(table).getAllByRole("row").slice(1);
    const cells = within(first).getAllByRole("cell").map((c) => c.textContent);
    expect(cells[0]).toBe("Oct 5, 202610:30 AM");
    expect(cells[1]).toBe("#710.0.0.4"); // user and IP address, as the feed showed them
    expect(cells[2]).toBe("Administrator");
    expect(cells[3]).toContain("Repayment verified");
    expect(within(first).getByRole("link", { name: "Payment #3" })).toHaveAttribute("href", "/admin/loans/5/repayments/3");
    expect(second).toHaveTextContent("PRIME pricing changed");
    expect(second).toHaveTextContent("prime-v1 → prime-v2"); // the summary stays on the row
    expect(container.innerHTML).not.toContain("SECRET.pdf");
  });

  it("loses nothing the old feed showed: every fact is on the row or in its details", async () => {
    const e = entry(3);
    serverApiFetch.mockResolvedValue(page([e]));
    const { container } = await renderPage();
    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    await userEvent.click(within(row).getByRole("button", { name: /^View details: Repayment verified/ }));

    // The old feed's line for this entry (AuditEntry, full):
    //   label · time · role #actor · IP · subject link · summary · detail fields
    const oldFeed = [
      "Repayment verified",
      "Oct 5, 2026",
      "Administrator",
      "#7",
      "10.0.0.4",
      "Payment #3",
      "K300", // the summary
      "loan id", "5", "amount", "300", // every non-hidden detail field
    ];
    for (const fact of oldFeed) expect(container).toHaveTextContent(fact);
    expect(container.innerHTML).not.toContain("SECRET.pdf"); // still hidden
    expect(container.innerHTML).not.toMatch(/storage path/);

    // And more than the feed had: the time to the second, the action code, the entry number.
    const detail = document.getElementById("audit-entry-3") as HTMLElement;
    expect(detail).toHaveTextContent("Mon, Oct 5, 2026, 10:30:00 AM GMT+10");
    expect(detail).toHaveTextContent("payment_verified");
    expect(detail).toHaveTextContent("#3");
  });

  it("shows before and after only where the entry recorded them", async () => {
    serverApiFetch.mockResolvedValue(
      page([
        entry(4, { action: "system_parameters_updated", entity_type: "SystemParameter", entity_id: null, details: { changes: { min_monthly_income: { before: 200, after: 250 } } } }),
        entry(2, { action: "prime_pricing_version_created", entity_type: "PrimePricingVersion", details: { before_version: "prime-v1", after_version: "prime-v2" } }),
        entry(1),
      ]),
    );
    await renderPage();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    for (const r of rows.slice(1)) await userEvent.click(within(r).getByRole("button", { name: /^View/ }));

    const changes = (id: number) => {
      const t = within(document.getElementById(`audit-entry-${id}`) as HTMLElement).queryByRole("table");
      return t ? within(t).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell").map((c) => c.textContent)) : null;
    };
    expect(changes(4)).toEqual([["min monthly income", "200", "250"]]);
    expect(changes(2)).toEqual([["version", "prime-v1", "prime-v2"]]);
    expect(changes(1)).toBeNull(); // a repayment entry carries no before/after - none is made up
  });

  it("opens and closes an entry's details from the keyboard", async () => {
    serverApiFetch.mockResolvedValue(page([entry(3)]));
    await renderPage();
    const button = screen.getByRole("button", { name: /^View details/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", "audit-entry-3");
    expect(button).toHaveAccessibleName(/^Hide details/);
    await userEvent.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("audit-entry-3")).toBeNull();
  });

  it("passes the URL's filters to the backend and keeps them in the form and paging links", async () => {
    serverApiFetch.mockResolvedValue(page([entry(1)], { total: 120, pages: 3, page: 2 }));
    await renderPage({ role: "admin", actor: "7", action: "payment_verified", from: "2026-10-01", to: "2026-10-05", page: "2" });
    const q = new URLSearchParams((serverApiFetch.mock.calls[0][0] as string).split("?")[1]);
    expect(Object.fromEntries(q)).toEqual({
      page: "2", per_page: "50", actor_role: "admin", actor_id: "7", action: "payment_verified",
      date_from: "2026-09-30T14:00:00.000+00:00", date_to: "2026-10-05T13:59:59.999+00:00",
    });
    expect(screen.getByLabelText("Actor role")).toHaveValue("admin");
    expect(screen.getByLabelText("Action")).toHaveValue("payment_verified");
    expect(screen.getByText("51–100 of 120")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Older" })).toHaveAttribute(
      "href", "/admin/audit-log?role=admin&actor=7&action=payment_verified&from=2026-10-01&to=2026-10-05&page=3",
    );
    expect(screen.getByRole("link", { name: "Newer" })).toHaveAttribute(
      "href", "/admin/audit-log?role=admin&actor=7&action=payment_verified&from=2026-10-01&to=2026-10-05",
    );
  });

  it("says when nothing matches the filters", async () => {
    serverApiFetch.mockResolvedValue(page([]));
    await renderPage({ action: "loan_written_off" });
    expect(screen.getByText("No entries match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/admin/audit-log");
  });

  it("handles a filter the backend refuses", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(400, "Invalid date");
    });
    await renderPage({ from: "2026-10-01" });
    expect(screen.getByRole("link", { name: "Clear the filters" })).toBeInTheDocument();
  });
});
