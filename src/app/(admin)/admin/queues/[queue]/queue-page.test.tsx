import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { loanItem, queuePage } from "@/components/admin/admin-fixtures.test-utils";

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

import AdminQueuePageView from "./page";

const props = (queue: string, page?: string) => ({
  params: Promise.resolve({ queue }),
  searchParams: Promise.resolve(page ? { page } : {}),
});

describe("Admin queue page", () => {
  beforeEach(() => {
    // Block body on purpose - see the dashboard test.
    serverApiFetch.mockReset();
  });

  it("404s for an unknown queue without calling the backend", async () => {
    await expect(AdminQueuePageView(props("awaiting_review"))).rejects.toThrow("NOT_FOUND");
    expect(serverApiFetch).not.toHaveBeenCalled();
  });

  it("asks for the requested page, 25 per page, and pages through the backend total", async () => {
    serverApiFetch.mockResolvedValue({
      ...queuePage("active_loans", [loanItem(26), loanItem(27)], 52),
      page: 2,
      per_page: 25,
    });
    render(await AdminQueuePageView(props("active_loans", "2")));
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/queues/active_loans?page=2&per_page=25");
    expect(screen.getByRole("heading", { name: "Active Loans" })).toBeInTheDocument();
    expect(screen.getByText("26–50 of 52")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/admin/queues/active_loans");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/admin/queues/active_loans?page=3");
    expect(screen.getByRole("link", { name: /Loan #26/ })).toHaveAttribute("href", "/admin/loans/26");
  });

  it("shows the queue's empty message", async () => {
    serverApiFetch.mockResolvedValue(queuePage("due_today", [], 0));
    render(await AdminQueuePageView(props("due_today")));
    expect(screen.getByText("Nothing is due today.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  it("offers the first page when the requested page is past the end", async () => {
    serverApiFetch.mockResolvedValue({ ...queuePage("overdue", [], 3), page: 9, per_page: 25 });
    render(await AdminQueuePageView(props("overdue", "9")));
    expect(screen.getByRole("link", { name: "Go to the first page" })).toHaveAttribute("href", "/admin/queues/overdue");
  });
});
