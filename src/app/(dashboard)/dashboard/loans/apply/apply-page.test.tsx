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

vi.mock("@/components/dashboard/loan-apply/LoanApplyWizard", () => ({ LoanApplyWizard: () => <p>THE WIZARD</p> }));
vi.mock("@/lib/session", () => ({ getLastApplicationDraft: async () => null }));

import LoanApplyPage from "./page";

const ready = { "/users/profile": { id: 7, full_name: "Grace" }, "/users/documents?document_type=id_verification": { documents: [] }, "/users/documents?document_type=loan_file": { documents: [] } };

describe("Apply page - one PRIME loan at a time", () => {
  beforeEach(() => {
    // Block body on purpose - see the dashboard test.
    serverApiFetch.mockReset();
  });

  it("explains instead of showing the form while an approved application waits for its payout", async () => {
    backend([app(5, "awaiting_disbursement")], [], ready);
    render(await LoanApplyPage());
    expect(screen.queryByText("THE WIZARD")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Your application #5 is approved and waiting to be paid out. You can apply again once that loan is fully repaid.",
    );
    expect(screen.getByRole("link", { name: "View your applications" })).toHaveAttribute("href", "/dashboard/applications");
  });

  it("explains instead of showing the form after an uncleared write-off", async () => {
    backend([app(6, "disbursed", 21)], [{ ...loan(21, "closed", "defaulted"), blocks_reapplication: true }], ready);
    render(await LoanApplyPage());
    expect(screen.queryByText("THE WIZARD")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Contact Prime's Vault to ask for a review.");
  });

  it("shows the form when nothing blocks a new application", async () => {
    backend([app(6, "rejected")], [{ ...loan(21, "closed", "defaulted"), blocks_reapplication: false }], ready);
    render(await LoanApplyPage());
    expect(screen.getByText("THE WIZARD")).toBeInTheDocument();
  });
});
