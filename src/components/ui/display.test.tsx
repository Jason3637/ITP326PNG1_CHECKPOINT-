import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert } from "./Alert";
import { EmptyState } from "./EmptyState";
import { MetricCard } from "./MetricCard";
import { PageHeader } from "./PageHeader";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { statusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

describe("statusTone", () => {
  it("maps the backend's own status values to the agreed colours", () => {
    expect(["approved", "disbursed", "paid", "verified", "paid_in_full"].map(statusTone)).toEqual(Array(5).fill("success"));
    expect(["awaiting_disbursement", "verification_pending", "reported", "pending", "due_today"].map(statusTone)).toEqual(
      Array(5).fill("warning"),
    );
    expect(["rejected", "overdue", "failed"].map(statusTone)).toEqual(Array(3).fill("danger"));
    expect(["submitted", "officer_review", "admin_review"].map(statusTone)).toEqual(Array(3).fill("info"));
    expect(["closed", "cancelled", "not_applicable", "draft"].map(statusTone)).toEqual(Array(4).fill("neutral"));
  });

  it("reads unknown or missing values as neutral", () => {
    expect(statusTone("something_new")).toBe("neutral");
    expect(statusTone(null)).toBe("neutral");
  });
});

describe("StatusBadge", () => {
  it("shows the label, coloured by the status's tone", () => {
    render(<StatusBadge status="rejected">Rejected</StatusBadge>);
    expect(screen.getByText("Rejected")).toHaveClass("bg-danger-light");
  });

  it("lets a caller override the tone", () => {
    render(
      <StatusBadge status="closed" tone="danger">
        Closed · Written off
      </StatusBadge>,
    );
    expect(screen.getByText("Closed · Written off")).toHaveClass("bg-danger-light");
  });
});

describe("Alert", () => {
  it("uses a role that fits the tone", () => {
    render(
      <>
        <Alert tone="success" title="Saved" />
        <Alert tone="danger" title="Couldn't save" />
        <Alert tone="warning" title="Applies to new applications only" />
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save");
    expect(screen.getByRole("note")).toHaveTextContent("Applies to new applications only");
  });

  it("can drop the role for a static notice", () => {
    render(<Alert tone="info" role={null} title="With the loan officer" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("headers, empty state and metric card", () => {
  it("PageHeader renders an h2 title, a back link and actions", () => {
    render(<PageHeader title="Settings" back={{ href: "/admin", label: "Back to dashboard" }} actions={<button>Export</button>} />);
    expect(screen.getByRole("heading", { level: 2, name: "Settings" })).toHaveClass("text-page-title");
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("SectionHeader renders the requested level with its scope", () => {
    render(<SectionHeader as="h3" id="x" title="Portfolio" scope="As of 6 Oct" />);
    expect(screen.getByRole("heading", { level: 3, name: "Portfolio" })).toHaveAttribute("id", "x");
    expect(screen.getByText("As of 6 Oct")).toBeInTheDocument();
  });

  it("EmptyState shows its message and action", () => {
    render(<EmptyState action={<a href="/admin">Go back</a>}>No loans are overdue.</EmptyState>);
    expect(screen.getByText("No loans are overdue.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toBeInTheDocument();
  });

  it("MetricCard can be a list item or a link", () => {
    const { rerender } = render(
      <ul>
        <MetricCard as="li" label="Outstanding" value="K1,200" definition="Owed on active loans." />
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("OutstandingK1,200Owed on active loans.");
    rerender(<MetricCard href="/admin/queues/overdue" label="Overdue" value="3" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/queues/overdue");
  });
});

describe("cn", () => {
  it("treats the custom type sizes as sizes, not colours", () => {
    expect(cn("text-neutral-900 text-page-title")).toBe("text-neutral-900 text-page-title");
    expect(cn("text-sm", "text-helper")).toBe("text-helper");
  });
});
