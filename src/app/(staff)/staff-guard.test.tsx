import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Layouts are async Server Components, which Vitest can't render directly
// (see Next's Vitest guide). They're called as plain async functions here
// and the JSX they return is rendered - that exercises the real guard code.

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  usePathname: () => "/staff",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

import StaffLayout from "./layout";
import DashboardLayout from "../(dashboard)/layout";
import AdminLayout from "../(admin)/layout";
import { ApiError, UnauthenticatedError } from "@/lib/server-api";
import { ROLE_RESYNC_PATH } from "@/lib/roles";

const me = (role: string) => ({ id: 1, email: "x@test", full_name: "Olive Officer", role, is_active: true, totp_enabled: true });

describe("staff layout guard (authoritative, from /auth/me)", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
  });

  it("blocks a customer - sends them through the role re-sync route, never renders the staff shell", async () => {
    serverApiFetch.mockResolvedValue(me("customer"));
    await expect(StaffLayout({ children: <p>staff content</p> })).rejects.toThrow(`REDIRECT:${ROLE_RESYNC_PATH}`);
    expect(serverApiFetch).toHaveBeenCalledWith("/auth/me");
  });

  it("blocks an unknown role the same way", async () => {
    serverApiFetch.mockResolvedValue(me("superuser"));
    await expect(StaffLayout({ children: null })).rejects.toThrow(`REDIRECT:${ROLE_RESYNC_PATH}`);
  });

  it("renders the staff shell for a loan officer", async () => {
    serverApiFetch.mockResolvedValue(me("loan_officer"));
    render(await StaffLayout({ children: <p>staff content</p> }));
    expect(screen.getByText("staff content")).toBeInTheDocument();
    expect(screen.getByText("Loan Officer")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Overview/ }).length).toBeGreaterThan(0);
    // Staff nav only - nothing in the shell points into the customer area.
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((h) => h?.startsWith("/staff"))).toBe(true);
  });

  it("sends an admin to their own area - the Loan Officer area is for loan officers", async () => {
    serverApiFetch.mockResolvedValue(me("admin"));
    await expect(StaffLayout({ children: <p>staff content</p> })).rejects.toThrow(`REDIRECT:${ROLE_RESYNC_PATH}`);
  });

  it("sends anyone without a valid session to /login", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new UnauthenticatedError();
    });
    await expect(StaffLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(500, "boom");
    });
    await expect(StaffLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
  });
});

describe("customer layout guard", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
  });

  it("sends staff out of the customer dashboard", async () => {
    serverApiFetch.mockResolvedValue(me("loan_officer"));
    await expect(DashboardLayout({ children: null })).rejects.toThrow(`REDIRECT:${ROLE_RESYNC_PATH}`);
    serverApiFetch.mockResolvedValue(me("admin"));
    await expect(DashboardLayout({ children: null })).rejects.toThrow(`REDIRECT:${ROLE_RESYNC_PATH}`);
  });

  it("renders the customer shell for a customer", async () => {
    serverApiFetch.mockResolvedValue({ ...me("customer"), full_name: "Grace Waigani" });
    render(await DashboardLayout({ children: <p>member content</p> }));
    expect(screen.getByText("member content")).toBeInTheDocument();
    expect(screen.queryByText("Loan Officer")).not.toBeInTheDocument();
  });
});

describe("admin layout guard (authoritative, from /auth/me)", () => {
  beforeEach(() => {
    // Block body on purpose - see above.
    serverApiFetch.mockReset();
  });

  it("blocks a loan officer, a customer and an unknown role - never renders the admin shell", async () => {
    for (const role of ["loan_officer", "customer", "superuser"]) {
      serverApiFetch.mockResolvedValue(me(role));
      await expect(AdminLayout({ children: <p>admin content</p> })).rejects.toThrow(`REDIRECT:${ROLE_RESYNC_PATH}`);
    }
    expect(serverApiFetch).toHaveBeenCalledWith("/auth/me");
  });

  it("renders the admin shell for an admin, with admin nav only", async () => {
    serverApiFetch.mockResolvedValue({ ...me("admin"), full_name: "Ada Admin" });
    render(await AdminLayout({ children: <p>admin content</p> }));
    expect(screen.getByText("admin content")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText("Loan Officer")).not.toBeInTheDocument();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((h) => h?.startsWith("/admin"))).toBe(true);
  });

  it("shows the queue counts from GET /admin/queues in the nav, and carries on without them if that fails", async () => {
    const counts = { awaiting_decision: 3, awaiting_disbursement: 0, active_loans: 5, due_today: 0, due_this_week: 1, overdue: 2, repayments_awaiting_verification: 4 };
    serverApiFetch.mockImplementation(async (path: string) =>
      path === "/auth/me"
        ? me("admin")
        : { as_of: "2026-10-06", queues: Object.fromEntries(Object.entries(counts).map(([k, count]) => [k, { label: k, count }])) },
    );
    render(await AdminLayout({ children: <p>admin content</p> }));
    expect(serverApiFetch).toHaveBeenCalledWith("/admin/queues");
    // Sidebar and phone drawer both carry the nav.
    expect(screen.getAllByRole("link", { name: "Final decisions (3)", hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Overdue (2)", hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "To verify (4)", hidden: true }).length).toBeGreaterThan(0);

    serverApiFetch.mockImplementation(async (path: string) => {
      if (path === "/auth/me") return me("admin");
      throw new ApiError(500, "boom");
    });
    render(await AdminLayout({ children: <p>still here</p> }));
    expect(screen.getByText("still here")).toBeInTheDocument();
  });

  it("sends anyone without a valid session to /login", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new UnauthenticatedError();
    });
    await expect(AdminLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(500, "boom");
    });
    await expect(AdminLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
  });
});
