import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let pathname = "/admin";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { Sidebar } from "./Sidebar";
import { AdminNavDrawer } from "./AdminNavDrawer";
import { Header } from "./Header";

// jsdom has no <dialog> behaviour; enough of it to drive the drawer.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const counts = { awaiting_decision: 0, awaiting_disbursement: 1, overdue: 2, repayments_awaiting_verification: 0, active_loans: 9 };

function current() {
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent?.trim());
}

describe("admin sidebar", () => {
  it("groups the nav under labelled sections", () => {
    render(<Sidebar variant="admin" adminCounts={counts} />);
    const loans = screen.getByRole("list", { name: "Loans" });
    expect(within(loans).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/admin/queues/active_loans",
      "/admin/queues/due_today",
      "/admin/queues/due_this_week",
      "/admin/queues/overdue",
    ]);
    expect(within(screen.getByRole("list", { name: "Repayments" })).getByRole("link")).toHaveAttribute("href", "/admin/repayments");
    expect(within(screen.getByRole("list", { name: "Administration" })).getAllByRole("link")).toHaveLength(2);
  });

  it("shows counts on the waiting-work queues only, read with the item's name", () => {
    render(<Sidebar variant="admin" adminCounts={counts} />);
    expect(screen.getByRole("link", { name: "Final decisions (0)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "To disburse (1)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overdue (2)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "To verify (0)" })).toBeInTheDocument();
    // Active loans has a count from the API but isn't waiting work.
    expect(screen.getByRole("link", { name: "Active loans" })).toBeInTheDocument();
  });

  it("shows no counts when they couldn't be read", () => {
    render(<Sidebar variant="admin" adminCounts={null} />);
    expect(screen.getByRole("link", { name: "Final decisions" })).toBeInTheDocument();
  });

  it.each([
    ["/admin", "Overview"],
    ["/admin/queues/awaiting_disbursement", "To disburse"],
    ["/admin/repayments", "To verify"],
    ["/admin/settings", "Settings"],
  ])("on %s exactly one entry is current: %s", (path, expected) => {
    pathname = path;
    render(<Sidebar variant="admin" adminCounts={null} />);
    expect(current()).toEqual([expected]);
  });

  it("highlights nothing on a detail page, as before", () => {
    pathname = "/admin/applications/8";
    render(<Sidebar variant="admin" adminCounts={null} />);
    expect(current()).toEqual([]);
  });
});

describe("admin nav drawer (below lg)", () => {
  it("opens from the menu button and closes from its close button", async () => {
    pathname = "/admin";
    render(<AdminNavDrawer counts={counts} />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).not.toHaveAttribute("open");

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByRole("link", { name: "Overdue (2)" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close menu" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("closes when a link is followed", async () => {
    render(<AdminNavDrawer counts={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("link", { name: "Analytics" }));
    expect(dialog).not.toHaveAttribute("open");
  });
});

describe("Header", () => {
  it("renders the admin menu slot and keeps the single h1", () => {
    render(<Header fullName="Ada Admin" layout="admin" menu={<button>Open menu</button>} roleLabel="Administrator" />);
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
