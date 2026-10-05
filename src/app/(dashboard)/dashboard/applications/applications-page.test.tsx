import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

const app = (id: number, status: string, loan_id: number | null = null) => ({
  id, status, loan_id, status_label: status, amount_requested: 500, prime_category: "PRIME 2",
  information_requests: [], action_required_note: null, submitted_at: "2026-08-30T00:00:00Z",
});
const loan = (id: number, status: string, closure_reason: string | null = null) => ({ id, status, closure_reason });

function backend(apps: unknown[], loans: unknown[], extra: Record<string, unknown> = {}) {
  serverApiFetch.mockImplementation(async (path: string) => {
    if (path === "/loans/applications/mine") return { count: apps.length, applications: apps };
    if (path === "/loans/mine") return { count: loans.length, loans };
    if (path in extra) return extra[path];
    throw new Error(`unexpected ${path}`);
  });
}
const applyLinks = () => screen.queryAllByRole("link").filter((l) => l.getAttribute("href") === "/dashboard/loans/apply");

import ApplicationsPage from "./page";

describe("My applications - one PRIME loan at a time", () => {
  beforeEach(() => {
    // Block body on purpose - see the dashboard test.
    serverApiFetch.mockReset();
  });

  it("hides 'Apply again' and says why while a loan is being repaid", async () => {
    backend([app(6, "rejected"), app(5, "disbursed", 21)], [loan(21, "overdue")]);
    render(await ApplicationsPage());
    expect(applyLinks()).toHaveLength(0);
    expect(screen.getByRole("note")).toHaveTextContent("You still have a loan (#21) to repay. You can apply again once it's fully repaid.");
  });

  it("offers 'Apply again' when nothing blocks it", async () => {
    backend([app(6, "rejected")], []);
    render(await ApplicationsPage());
    expect(applyLinks()).toHaveLength(1);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("offers 'Apply for a Loan' to a customer with no applications yet", async () => {
    backend([], []);
    render(await ApplicationsPage());
    expect(applyLinks()).toHaveLength(1);
  });
});
