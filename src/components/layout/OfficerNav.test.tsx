import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let pathname = "/staff";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { OfficerNav, OfficerNavDrawer } from "./OfficerNav";
import { PortalShell } from "./PortalShell";
import { staffQueueNavItems } from "@/lib/nav";

const counts = { awaiting_review: 2, under_review: 1, customer_action_required: 0, sent_to_admin: 4, returned_by_admin: 0 };

function current() {
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent?.trim());
}

describe("officer nav", () => {
  it("keeps Overview on top and groups the five queues under Applications, with the same routes", () => {
    pathname = "/staff";
    render(<OfficerNav counts={null} />);
    const nav = screen.getByRole("navigation", { name: "Loan Officer" });
    const [top, applications] = within(nav).getAllByRole("list");
    expect(within(top).getByRole("link")).toHaveAttribute("href", "/staff");
    expect(applications).toBe(screen.getByRole("list", { name: "Applications" }));
    expect(within(applications).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual(
      staffQueueNavItems.map((q) => [q.label, q.href]),
    );
    // Shown in capitals by CSS; the words stay readable.
    expect(screen.getByText("Applications")).toHaveClass("uppercase");
  });

  it.each([
    ["/staff", "Overview"],
    ["/staff/queues/awaiting_review", "New Applications"],
    ["/staff/queues/customer_action_required", "Awaiting Customer Information"],
    ["/staff/queues/returned_by_admin", "Returned for Review"],
    ["/staff/applications/8", "Overview"],
    ["/staff/applications/8/customer-history", "Overview"],
  ])("on %s exactly one entry is current: %s", (path, expected) => {
    pathname = path;
    render(<OfficerNav counts={null} />);
    expect(current()).toEqual([expected]);
  });

  it("marks the current item by a bar and weight as well as colour", () => {
    pathname = "/staff/queues/under_review";
    render(<OfficerNav counts={null} />);
    const link = screen.getByRole("link", { name: "Under Review" });
    expect(link).toHaveClass("font-semibold");
    expect(link.querySelector("span.bg-primary[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Overview" }).querySelector("span.bg-primary")).toBeNull();
  });

  it("shows each queue's total, read as words", () => {
    pathname = "/staff";
    render(<OfficerNav counts={counts} />);
    expect(screen.getByRole("link", { name: "New Applications, 2 applications" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Under Review, 1 application" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Returned for Review, 0 applications" })).toBeInTheDocument();
    // Overview has no count of its own.
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    const pill = within(screen.getByRole("link", { name: /^Sent to Administrator/ })).getByText("4");
    expect(pill).toHaveAttribute("aria-hidden", "true");
    expect(pill).toHaveClass("bg-primary-light");
    expect(within(screen.getByRole("link", { name: /^Returned for Review/ })).getByText("0")).toHaveClass("bg-neutral-100");
  });

  it("shows no counts when they couldn't be read", () => {
    render(<OfficerNav counts={null} />);
    for (const q of staffQueueNavItems) expect(screen.getByRole("link", { name: q.label })).toBeInTheDocument();
  });
});

describe("officer nav drawer (below lg)", () => {
  it("opens from the menu button, and closes from its close button or a followed link", async () => {
    pathname = "/staff";
    render(<OfficerNavDrawer counts={counts} />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).not.toHaveAttribute("open");

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByRole("link", { name: "New Applications, 2 applications" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close menu" }));
    expect(dialog).not.toHaveAttribute("open");

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await userEvent.click(within(dialog).getByRole("link", { name: "Overview" }));
    expect(dialog).not.toHaveAttribute("open");
  });
});

describe("officer workspace frame", () => {
  it("has a skip link first, landmarks, the drawer button and no phone bottom bar", async () => {
    pathname = "/staff";
    render(
      <PortalShell variant="staff" fullName="Olive Officer" homeHref="/staff" roleLabel="Loan Officer" officerCounts={counts}>
        <p>page</p>
      </PortalShell>,
    );
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#main-content");
    // Off-screen until focused, then in view - never display:none.
    expect(skip).toHaveClass("fixed", "-translate-y-24", "focus:translate-y-0");

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    // Officer pages keep their control sizes until they're redesigned.
    expect(main).not.toHaveAttribute("data-density");
    // 1280px by default; a page marked data-page-width="wide" gets 1440px.
    expect(main.firstElementChild).toHaveClass("max-w-7xl", "has-[[data-page-width=wide]]:max-w-360");
    expect(main).toHaveClass("lg:px-8", "xl:px-10");

    expect(screen.getByRole("banner")).toHaveClass("sticky");
    expect(screen.getByRole("banner").firstElementChild).toHaveClass("h-16");
    expect(screen.getAllByRole("navigation", { name: "Loan Officer" })).toHaveLength(1); // drawer is closed
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveClass("w-64", "sticky", "lg:flex");
    // Still the single h1 greeting; logout and profile unchanged.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/staff");
  });

  it("leaves the customer shell as it was: bottom bar, no skip link, no drawer", () => {
    pathname = "/dashboard";
    render(
      <PortalShell variant="customer" fullName="Mary Member">
        <p>page</p>
      </PortalShell>,
    );
    expect(screen.queryByRole("link", { name: "Skip to content" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("max-w-6xl");
    expect(screen.getAllByRole("link", { name: "Loans" })).toHaveLength(2); // sidebar + bottom bar
  });
});
