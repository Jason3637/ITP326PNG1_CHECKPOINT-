import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

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

  it("lists entries newest first with who, when, what and a link to the subject", async () => {
    serverApiFetch.mockResolvedValue(page([entry(3), entry(2, { action: "prime_pricing_version_created", entity_type: "PrimePricingVersion", details: { before_version: "prime-v1", after_version: "prime-v2" } })]));
    const { container } = await renderPage();
    expect(serverApiFetch).toHaveBeenCalledWith("/reports/audit-logs?page=1&per_page=50");
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Repayment verified");
    expect(items[0]).toHaveTextContent("Administrator #7 · 10.0.0.4");
    expect(within(items[0]).getByRole("link", { name: "Payment #3" })).toHaveAttribute("href", "/admin/loans/5/repayments/3");
    expect(items[1]).toHaveTextContent("PRIME pricing changed");
    expect(items[1]).toHaveTextContent("prime-v1 → prime-v2");
    expect(container.innerHTML).not.toContain("SECRET.pdf");
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
