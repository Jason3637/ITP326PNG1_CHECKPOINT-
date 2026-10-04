import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { OfficerQueue, QueueItem, QueuePage } from "@/lib/types";

// The page is an async Server Component: called as a function, its JSX rendered.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import StaffDashboardPage from "./page";
import { UnauthenticatedError } from "@/lib/server-api";

function item(id: number, overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id,
    status: "submitted",
    customer_id: 100 + id,
    customer_name: `Customer ${id}`,
    amount_requested: 500,
    prime_category: "PRIME 2",
    total_repayable: 675,
    purpose_category: "business",
    submitted_at: "2026-09-20T00:00:00+00:00",
    assigned_officer_id: null,
    assigned_officer_name: null,
    assigned_at: null,
    is_mine: false,
    open_information_requests: 0,
    latest_recommendation: null,
    returned_reason: null,
    ...overrides,
  };
}

const pages: Record<OfficerQueue, QueueItem[]> = {
  awaiting_review: [1, 2, 3, 4, 5].map((id) => item(id)),
  under_review: [item(8, { status: "officer_review", is_mine: true, assigned_officer_id: 1 })],
  customer_action_required: [],
  sent_to_admin: [item(12, { status: "recommended_for_rejection", is_mine: true, assigned_officer_id: 1 })],
  returned_by_admin: [item(15, { status: "returned_to_officer", returned_reason: "Re-check the referee." })],
};
const totals: Record<OfficerQueue, number> = {
  awaiting_review: 7,
  under_review: 1,
  customer_action_required: 0,
  sent_to_admin: 1,
  returned_by_admin: 1,
};

function mockBackend() {
  serverApiFetch.mockImplementation(async (path: string) => {
    if (path === "/officer/queues") {
      return {
        queues: Object.fromEntries(
          Object.entries(totals).map(([k, total]) => [k, { total, mine: k === "awaiting_review" ? 0 : total, unassigned: k === "awaiting_review" ? 7 : 0 }]),
        ),
        definitions: {},
      };
    }
    const queue = path.match(/^\/officer\/queues\/([a-z_]+)\?per_page=5$/)?.[1] as OfficerQueue | undefined;
    if (!queue) throw new Error(`unexpected path ${path}`);
    const page: QueuePage = {
      queue,
      statuses: queue === "sent_to_admin" ? ["recommended_for_approval", "recommended_for_rejection", "admin_review"] : ["x" as never],
      page: 1,
      per_page: 5,
      total: totals[queue],
      pages: 1,
      items: pages[queue],
    };
    return page;
  });
}

const section = (title: string) => screen.getByRole("heading", { name: title }).closest("div.rounded-xl") as HTMLElement;

describe("Loan Officer dashboard (queues)", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
  });

  it("shows the five summary counts with the required labels", async () => {
    mockBackend();
    render(await StaffDashboardPage());
    const tiles = within(screen.getByRole("region", { name: "Queue summary" }));
    for (const [label, n] of [
      ["New Applications", 7],
      ["Under Review", 1],
      ["Awaiting Customer Information", 0],
      ["Sent to Administrator", 1],
      ["Returned for Review", 1],
    ] as const) {
      expect(tiles.getByText(label).parentElement).toHaveTextContent(`${label}${n}`);
    }
    expect(tiles.getByText("7 unassigned")).toBeInTheDocument();
  });

  it("shows every queue, each item linking into the review workspace", async () => {
    mockBackend();
    render(await StaffDashboardPage());
    for (const title of [
      "Applications Awaiting Review",
      "Under Review",
      "Customer Action Required",
      "Recommended / Sent to Administrator",
      "Returned by Administrator",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(within(section("Under Review")).getByRole("link", { name: /#8/ })).toHaveAttribute("href", "/staff/applications/8");
    expect(within(section("Customer Action Required")).getByText("No applications waiting on a customer.")).toBeInTheDocument();
    expect(within(section("Recommended / Sent to Administrator")).getByText("Recommended: reject")).toBeInTheDocument();
    expect(within(section("Returned by Administrator")).getByText("Returned: Re-check the referee.")).toBeInTheDocument();
  });

  it("previews 5 per queue and links to the full queue when there are more", async () => {
    mockBackend();
    render(await StaffDashboardPage());
    const awaiting = section("Applications Awaiting Review");
    expect(within(awaiting).getAllByRole("link", { name: /^#\d/ })).toHaveLength(5);
    expect(within(awaiting).getByRole("link", { name: "View all 7" })).toHaveAttribute("href", "/staff/queues/awaiting_review");
    expect(serverApiFetch).toHaveBeenCalledWith("/officer/queues/awaiting_review?per_page=5");
  });

  it("is work queues only - nothing from the admin/reporting endpoints", async () => {
    mockBackend();
    const { container } = render(await StaffDashboardPage());
    const paths = serverApiFetch.mock.calls.map((c) => c[0] as string);
    expect(paths.every((p) => p.startsWith("/officer/queues"))).toBe(true);
    expect(container.textContent).not.toMatch(/parameter|performance|report/i);
  });

  it("sends an expired session to /login", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new UnauthenticatedError();
    });
    await expect(StaffDashboardPage()).rejects.toThrow("REDIRECT:/login");
  });
});
