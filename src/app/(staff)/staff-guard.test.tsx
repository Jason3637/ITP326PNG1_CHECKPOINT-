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

  it("renders for an admin", async () => {
    serverApiFetch.mockResolvedValue(me("admin"));
    render(await StaffLayout({ children: <p>staff content</p> }));
    expect(screen.getByText("Admin")).toBeInTheDocument();
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
  });

  it("renders the customer shell for a customer", async () => {
    serverApiFetch.mockResolvedValue({ ...me("customer"), full_name: "Grace Waigani" });
    render(await DashboardLayout({ children: <p>member content</p> }));
    expect(screen.getByText("member content")).toBeInTheDocument();
    expect(screen.queryByText("Loan Officer")).not.toBeInTheDocument();
  });
});
