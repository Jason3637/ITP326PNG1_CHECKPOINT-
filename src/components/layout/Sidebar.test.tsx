import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/staff";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { Sidebar } from "./Sidebar";
import { isTopNavItemActive, staffQueueNavItems } from "@/lib/nav";

function current() {
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent?.trim());
}

describe("staff sidebar highlighting", () => {
  it("lists every queue under Overview, with the dashboard's labels", () => {
    pathname = "/staff";
    render(<Sidebar variant="staff" />);
    expect(staffQueueNavItems.map((q) => q.label)).toEqual([
      "New Applications",
      "Under Review",
      "Awaiting Customer Information",
      "Sent to Administrator",
      "Returned for Review",
    ]);
    for (const q of staffQueueNavItems) {
      expect(screen.getByRole("link", { name: q.label })).toHaveAttribute("href", q.href);
    }
  });

  it.each([
    ["/staff", "Overview"],
    ["/staff/queues/under_review", "Under Review"],
    ["/staff/queues/sent_to_admin?assigned=me&page=2", "Sent to Administrator"],
    ["/staff/applications/8", "Overview"],
    ["/staff/applications/8/customer-history", "Overview"],
  ])("on %s exactly one entry is current: %s", (path, expected) => {
    pathname = path.split("?")[0];
    render(<Sidebar variant="staff" />);
    expect(current()).toEqual([expected]);
  });

  it("leaves the customer sidebar unchanged (no sub-items)", () => {
    pathname = "/dashboard/loans";
    render(<Sidebar variant="customer" />);
    expect(current()).toEqual(["Loans"]);
    expect(screen.queryByRole("link", { name: "Under Review" })).not.toBeInTheDocument();
  });
});

describe("isTopNavItemActive", () => {
  it("defers to a matching sub-item, otherwise follows isNavItemActive", () => {
    expect(isTopNavItemActive("/staff", "/staff", "staff")).toBe(true);
    expect(isTopNavItemActive("/staff/queues/awaiting_review", "/staff", "staff")).toBe(false);
    expect(isTopNavItemActive("/staff/applications/3", "/staff", "staff")).toBe(true);
    expect(isTopNavItemActive("/dashboard", "/dashboard", "customer")).toBe(true);
    expect(isTopNavItemActive("/dashboard/loans", "/dashboard", "customer")).toBe(false);
  });
});
