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
  returned_by_admin: [
    item(15, { status: "returned_to_officer", is_mine: true, assigned_officer_id: 1, returned_reason: "Re-check the referee." }),
  ],
};
// Each list's backend total - under review "mine" holds more than the preview.
const totals: Record<OfficerQueue, number> = {
  awaiting_review: 7,
  under_review: 6,
  customer_action_required: 0,
  sent_to_admin: 1,
  returned_by_admin: 1,
};
const queueTotals: Record<OfficerQueue, number> = { ...totals, under_review: 9 };

// The overview's own reads: two lists narrowed to the officer, three whole.
const EXPECTED_PATHS = [
  "/officer/queues",
  "/officer/queues/awaiting_review?per_page=5",
  "/officer/queues/under_review?per_page=5&assigned=me",
  "/officer/queues/customer_action_required?per_page=5",
  "/officer/queues/sent_to_admin?per_page=5",
  "/officer/queues/returned_by_admin?per_page=5&assigned=me",
];

function mockBackend() {
  serverApiFetch.mockImplementation(async (path: string) => {
    if (path === "/officer/queues") {
      return {
        queues: Object.fromEntries(
          Object.entries(queueTotals).map(([k, total]) => [
            k,
            { total, mine: k === "awaiting_review" ? 0 : totals[k as OfficerQueue], unassigned: k === "awaiting_review" ? 7 : 0 },
          ]),
        ),
        definitions: {},
      };
    }
    if (!EXPECTED_PATHS.includes(path)) throw new Error(`unexpected path ${path}`);
    const queue = path.match(/^\/officer\/queues\/([a-z_]+)\?/)![1] as OfficerQueue;
    const page: QueuePage = {
      queue,
      statuses: ["x" as never],
      page: 1,
      per_page: 5,
      total: totals[queue],
      pages: 1,
      items: pages[queue],
    };
    return page;
  });
}

const section = (name: string) => screen.getByRole("region", { name });

describe("Loan Officer overview (priority first)", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
  });

  it("shows the five queue totals as tiles linking to each queue", async () => {
    mockBackend();
    render(await StaffDashboardPage());
    const tiles = within(section("Queue summary"));
    for (const [label, n, href] of [
      ["New Applications", 7, "/staff/queues/awaiting_review"],
      ["Under Review", 9, "/staff/queues/under_review"],
      ["Awaiting Customer Information", 0, "/staff/queues/customer_action_required"],
      ["Sent to Administrator", 1, "/staff/queues/sent_to_admin"],
      ["Returned for Review", 1, "/staff/queues/returned_by_admin"],
    ] as const) {
      const link = tiles.getByText(label).closest("a")!;
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveTextContent(`${label}${n}`);
    }
    expect(tiles.getByText("7 unassigned")).toBeInTheDocument();
    expect(tiles.getByText("6 assigned to you")).toBeInTheDocument();
  });

  it("puts the officer's own work and new applications above what's waiting on others", async () => {
    mockBackend();
    render(await StaffDashboardPage());
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Queue summary", "My work", "Available to claim", "Waiting"]);
    const waiting = within(section("Waiting"));
    expect(waiting.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Awaiting Customer Information",
      "Sent to Administrator",
    ]);
  });

  it("lists my work - returned first, then under review - each row linking into the review workspace", async () => {
    mockBackend();
    render(await StaffDashboardPage());
    const table = within(section("My work")).getByRole("table");
    const links = within(table).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/staff/applications/15", "/staff/applications/8"]);
    expect(links.map((a) => a.textContent?.trim().split(" ")[0])).toEqual(["Continue", "Continue"]);
    expect(within(table).getByText("Returned: Re-check the referee.")).toBeInTheDocument();
    // Its own work: no Assigned column.
    expect(within(table).queryByRole("columnheader", { name: "Assigned" })).not.toBeInTheDocument();
    expect(within(section("My work")).getByRole("link", { name: "All under your review (6)" })).toHaveAttribute(
      "href",
      "/staff/queues/under_review?assigned=me",
    );
    expect(within(section("My work")).queryByRole("link", { name: /All returned to you/ })).not.toBeInTheDocument();
  });

  it("previews 5 new applications to claim and links to the full queue when there are more", async () => {
    mockBackend();
    render(await StaffDashboardPage());
    const available = within(section("Available to claim"));
    const rows = within(available.getByRole("table")).getAllByRole("link");
    expect(rows).toHaveLength(5);
    expect(rows.every((a) => a.textContent?.startsWith("Review"))).toBe(true);
    expect(available.getByRole("link", { name: "View all (7)" })).toHaveAttribute("href", "/staff/queues/awaiting_review");
  });

  it("keeps waiting lists quiet, and an empty one to a single line", async () => {
    mockBackend();
    render(await StaffDashboardPage());
    const waiting = within(section("Waiting"));
    expect(waiting.getByText("No applications waiting on a customer.").closest("div.rounded-lg")).toHaveClass("py-2.5");
    expect(within(waiting.getByRole("table", { name: "Sent to Administrator" })).getByText("Recommended: reject")).toBeInTheDocument();
    expect(waiting.queryByRole("link", { name: /View all/ })).not.toBeInTheDocument();
  });

  it("reads only the officer queue endpoints - the same six requests as before, no admin or reporting data", async () => {
    mockBackend();
    const { container } = render(await StaffDashboardPage());
    const paths = serverApiFetch.mock.calls.map((c) => c[0] as string);
    expect([...paths].sort()).toEqual([...EXPECTED_PATHS].sort());
    expect(container.textContent).not.toMatch(/parameter|performance|report/i);
  });

  it("sends an expired session to /login", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new UnauthenticatedError();
    });
    await expect(StaffDashboardPage()).rejects.toThrow("REDIRECT:/login");
  });
});
