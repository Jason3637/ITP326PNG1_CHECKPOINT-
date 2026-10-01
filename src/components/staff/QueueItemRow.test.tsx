import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueItemRow } from "./QueueItemRow";
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

function renderRow(props: Parameters<typeof QueueItemRow>[0]) {
  return render(
    <ul>
      <QueueItemRow {...props} />
    </ul>,
  );
}

describe("QueueItemRow", () => {
  it("links into the Application Review Workspace", () => {
    renderRow({ item: item() });
    expect(screen.getByRole("link")).toHaveAttribute("href", "/staff/applications/42");
  });

  it("shows the triage essentials with human labels, not raw enums", () => {
    renderRow({ item: item() });
    expect(screen.getByText("#42 · Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("K5,000 · PRIME 3 · School Fees")).toBeInTheDocument();
    expect(screen.getByText("Assigned to you")).toBeInTheDocument();
    expect(screen.getByText("Yours")).toBeInTheDocument();
    expect(screen.queryByText(/school_fees|officer_review/)).not.toBeInTheDocument();
  });

  it("names another officer's assignment and drops the Yours badge", () => {
    renderRow({ item: item({ is_mine: false, assigned_officer_id: 2, assigned_officer_name: "Ben Kila" }) });
    expect(screen.getByText("Assigned to Ben Kila")).toBeInTheDocument();
    expect(screen.queryByText("Yours")).not.toBeInTheDocument();
  });

  it("only shows a status badge when asked (multi-status queues)", () => {
    const sent = item({ status: "recommended_for_rejection" });
    const { unmount } = renderRow({ item: sent });
    expect(screen.queryByText("Recommended: reject")).not.toBeInTheDocument();
    unmount();
    renderRow({ item: sent, showStatus: true });
    expect(screen.getByText("Recommended: reject")).toBeInTheDocument();
  });

  it("surfaces open information requests and an admin's return reason", () => {
    renderRow({ item: item({ open_information_requests: 2, returned_reason: "Payslip is from 2024." }) });
    expect(screen.getByText("2 open information requests")).toBeInTheDocument();
    expect(screen.getByText("Returned: Payslip is from 2024.")).toBeInTheDocument();
  });
});
