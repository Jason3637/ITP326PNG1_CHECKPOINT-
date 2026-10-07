import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { QueueItem, QueuePage } from "@/lib/types";

// The page is an async Server Component: called as a function, its JSX rendered.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import QueuePageView from "./page";
import { ApiError, UnauthenticatedError } from "@/lib/server-api";

function item(id: number, overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id,
    status: "officer_review",
    customer_id: 100 + id,
    customer_name: `Customer ${id}`,
    amount_requested: 500,
    prime_category: "PRIME 2",
    total_repayable: 675,
    purpose_category: "business",
    submitted_at: "2026-09-20T00:00:00+00:00",
    assigned_officer_id: 2,
    assigned_officer_name: "Ben Kila",
    assigned_at: "2026-09-21T00:00:00+00:00",
    is_mine: false,
    open_information_requests: 0,
    latest_recommendation: null,
    returned_reason: null,
    ...overrides,
  };
}

function backend(page: Partial<QueuePage>, counts: { total: number; mine: number; unassigned: number } | Error) {
  serverApiFetch.mockImplementation(async (path: string) => {
    if (path === "/officer/queues") {
      if (counts instanceof Error) throw counts;
      return { queues: { under_review: counts }, definitions: {} };
    }
    return { queue: "under_review", statuses: ["officer_review"], page: 1, per_page: 25, total: 0, pages: 1, items: [], ...page };
  });
}

const view = (queue: string, sp: Record<string, string> = {}) =>
  QueuePageView({ params: Promise.resolve({ queue }), searchParams: Promise.resolve(sp) });

describe("Loan Officer queue page", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
  });

  it("shows a compact header with the count, a back link and the queue's description", async () => {
    backend({ total: 30, pages: 2, items: [item(1)] }, { total: 30, mine: 4, unassigned: 1 });
    render(await view("under_review"));
    expect(screen.getByRole("heading", { level: 2, name: "Under Review" }).parentElement).toHaveTextContent("Under Review30");
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/staff");
    expect(screen.getByText("Claimed and being checked by an officer.")).toBeInTheDocument();
  });

  it("keeps all three assignment filters, each with how many it holds, the current one marked", async () => {
    backend({ total: 4, items: [item(1, { is_mine: true })] }, { total: 30, mine: 4, unassigned: 0 });
    render(await view("under_review", { assigned: "me" }));
    const filters = within(screen.getByRole("navigation", { name: "Filter by assignment" }));
    expect(filters.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["All30, 30 applications", "/staff/queues/under_review"],
      ["Assigned to me4, 4 applications", "/staff/queues/under_review?assigned=me"],
      ["Unassigned0, 0 applications", "/staff/queues/under_review?assigned=unassigned"],
    ]);
    expect(filters.getByRole("link", { name: /^Assigned to me/ })).toHaveAttribute("aria-current", "page");
    // The filter goes to the backend unchanged.
    expect(serverApiFetch).toHaveBeenCalledWith("/officer/queues/under_review?page=1&per_page=25&assigned=me");
  });

  it("still filters when the counts can't be read - they're just left out", async () => {
    backend({ total: 1, items: [item(1)] }, new ApiError(500, "boom"));
    render(await view("under_review"));
    const filters = within(screen.getByRole("navigation", { name: "Filter by assignment" }));
    expect(filters.getAllByRole("link").map((a) => a.textContent)).toEqual(["All", "Assigned to me", "Unassigned"]);
  });

  it("lists every item on the page as a row linking into the review workspace", async () => {
    const items = [item(1), item(2, { is_mine: true }), item(3, { assigned_officer_id: null, assigned_officer_name: null })];
    backend({ total: 3, items }, { total: 3, mine: 1, unassigned: 1 });
    render(await view("under_review"));
    const table = screen.getByRole("table", { name: "Under Review, all" });
    expect(within(table).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(
      items.map((i) => `/staff/applications/${i.id}`),
    );
    for (const text of ["Assigned to Ben Kila", "Assigned to you", "Unassigned"]) {
      expect(within(table).getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText("1–3 of 3")).toBeInTheDocument();
  });

  it("pages through the queue, keeping the filter", async () => {
    backend({ total: 60, page: 2, pages: 3, items: [item(26)] }, { total: 60, mine: 0, unassigned: 60 });
    render(await view("under_review", { assigned: "unassigned", page: "2" }));
    const pager = within(screen.getByRole("navigation", { name: "Pagination" }));
    expect(pager.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(pager.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/staff/queues/under_review?assigned=unassigned");
    expect(pager.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/staff/queues/under_review?assigned=unassigned&page=3");
    expect(screen.getByText("26–50 of 60")).toBeInTheDocument();
  });

  it("says so in one line when the queue or filter is empty", async () => {
    backend({ total: 0, items: [] }, { total: 0, mine: 0, unassigned: 0 });
    const { unmount } = render(await view("under_review"));
    expect(screen.getByText("Nothing under review right now.").closest("div.rounded-lg")).toHaveClass("py-2.5");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    unmount();

    backend({ total: 0, items: [] }, { total: 5, mine: 0, unassigned: 0 });
    render(await view("under_review", { assigned: "me" }));
    expect(screen.getByText("No applications match this filter.")).toBeInTheDocument();
  });

  it("offers the first page when a page past the end is asked for", async () => {
    backend({ total: 3, page: 9, pages: 1, items: [] }, { total: 3, mine: 0, unassigned: 0 });
    render(await view("under_review", { page: "9" }));
    expect(screen.getByText("No applications on this page.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the first page" })).toHaveAttribute("href", "/staff/queues/under_review");
  });

  it("404s for an unknown queue and sends an expired session to /login", async () => {
    await expect(view("nope")).rejects.toThrow("NOT_FOUND");
    serverApiFetch.mockImplementation(async () => {
      throw new UnauthenticatedError();
    });
    await expect(view("under_review")).rejects.toThrow("REDIRECT:/login");
  });
});
