import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueueTable } from "./QueueTable";
import type { QueueItem } from "@/lib/types";

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 42,
    status: "officer_review",
    customer_id: 7,
    customer_name: "Jane Doe",
    amount_requested: 5000,
    prime_category: "PRIME 3",
    total_repayable: 5750,
    purpose_category: "school_fees",
    submitted_at: "2026-01-01T00:00:00.000Z",
    assigned_officer_id: 1,
    assigned_officer_name: "Olive Officer",
    assigned_at: "2026-01-02T00:00:00.000Z",
    is_mine: true,
    open_information_requests: 0,
    latest_recommendation: null,
    returned_reason: null,
    ...overrides,
  };
}

const table = () => screen.getByRole("table", { name: "Queue" });

describe("QueueTable", () => {
  it("is a real table with column headers, named by its caption", () => {
    render(<QueueTable items={[item()]} caption="Queue" emptyMessage="Nothing." />);
    expect(within(table()).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Application",
      "Customer",
      "Amount",
      "PRIME",
      "Status",
      "Assigned",
      "Age",
      "Action",
    ]);
  });

  it("shows the triage essentials with human labels, not raw enums", () => {
    render(<QueueTable items={[item()]} caption="Queue" emptyMessage="Nothing." />);
    const row = within(table()).getAllByRole("row")[1];
    for (const text of ["#42", "School Fees", "Jane Doe", "K5,000", "PRIME 3", "Under review", "Assigned to you", "Submitted Jan 1, 2026"]) {
      expect(within(row).getByText(text)).toBeInTheDocument();
    }
    expect(within(row).getByText(/^Open for \d+ days$/)).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/school_fees|officer_review/);
  });

  it("has one link per row - its action - into the review workspace, naming the application", () => {
    render(
      <QueueTable
        items={[item(), item({ id: 7, status: "submitted", is_mine: false, assigned_officer_id: null, assigned_officer_name: null })]}
        caption="Queue"
        emptyMessage="Nothing."
      />,
    );
    const links = within(table()).getAllByRole("link");
    expect(links.map((a) => [a.textContent?.trim(), a.getAttribute("href")])).toEqual([
      ["Continue application #42, Jane Doe", "/staff/applications/42"],
      ["Review application #7, Jane Doe", "/staff/applications/7"],
    ]);
    // Stretched over the row, so the whole row is clickable.
    expect(links[0]).toHaveClass("after:absolute", "after:inset-0");
    expect(links[0].closest("tr")).toHaveClass("relative");
  });

  it("names another officer's assignment, and an unassigned one", () => {
    render(
      <QueueTable
        items={[
          item({ is_mine: false, assigned_officer_id: 3, assigned_officer_name: "Ben Kila" }),
          item({ id: 43, is_mine: false, assigned_officer_id: null, assigned_officer_name: null }),
        ]}
        caption="Queue"
        emptyMessage="Nothing."
      />,
    );
    expect(within(table()).getByText("Assigned to Ben Kila")).toBeInTheDocument();
    expect(within(table()).getByText("Unassigned")).toBeInTheDocument();
    expect(within(table()).getAllByRole("link")[0]).toHaveTextContent(/^View/);
  });

  it("surfaces open information requests and an admin's return reason under the status", () => {
    render(
      <QueueTable
        items={[item({ status: "returned_to_officer", open_information_requests: 2, returned_reason: "Payslip is from 2024." })]}
        caption="Queue"
        emptyMessage="Nothing."
      />,
    );
    expect(within(table()).getByText("Returned")).toBeInTheDocument();
    expect(within(table()).getByText("2 open information requests")).toBeInTheDocument();
    expect(within(table()).getByText("Returned: Payslip is from 2024.")).toBeInTheDocument();
  });

  it("shows a status badge with an icon on every row, using the shared status mapping", () => {
    const { container } = render(
      <QueueTable items={[item({ status: "recommended_for_rejection", is_mine: false })]} caption="Queue" emptyMessage="Nothing." />,
    );
    const badge = within(table()).getByText("Recommended: reject");
    expect(badge).toHaveClass("bg-warning-light");
    expect(badge.querySelector("svg")).not.toBeNull();
    expect(container).toBeTruthy();
  });

  it("shows a dash, with words for screen readers, for what the backend didn't send", () => {
    render(
      <QueueTable
        items={[item({ prime_category: null, purpose_category: null, submitted_at: null, customer_name: null })]}
        caption="Queue"
        emptyMessage="Nothing."
      />,
    );
    expect(within(table()).getAllByText("Not recorded")).toHaveLength(2); // PRIME and age
    expect(within(table()).getByText("Unknown customer")).toBeInTheDocument();
    expect(within(table()).queryByText(/Submitted/)).not.toBeInTheDocument();
  });

  it("can leave out the Assigned column where every row is the viewer's", () => {
    render(<QueueTable items={[item()]} caption="Queue" emptyMessage="Nothing." showAssignment={false} />);
    expect(within(table()).queryByRole("columnheader", { name: "Assigned" })).not.toBeInTheDocument();
  });

  it("has the same rows as a stacked list for phones, each a single link", () => {
    render(<QueueTable items={[item(), item({ id: 43 })]} caption="Queue" emptyMessage="Nothing." />);
    const list = screen.getByRole("list", { name: "Queue" });
    const links = within(list).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/staff/applications/42", "/staff/applications/43"]);
    expect(within(list).getAllByText("#42 · Jane Doe")).toHaveLength(1);
  });

  it("is one compact line when empty - no table", () => {
    render(<QueueTable items={[]} caption="Queue" emptyMessage="Nothing waiting on an administrator." />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing waiting on an administrator.").closest("div.rounded-lg")).toHaveClass("py-2.5");
  });
});
