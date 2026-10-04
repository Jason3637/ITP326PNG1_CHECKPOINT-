import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// proxy.ts only needs the cookie-name constants from session.ts, but that
// module imports next/headers, which isn't available outside a request.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { proxy } = await import("./proxy");

function request(path: string, cookies: Record<string, string>) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
}

function redirectTarget(res: Response) {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

const session = { pv_access_token: "a", pv_refresh_token: "r" };

describe("proxy", () => {
  it("sends anyone without a session to /login, for both areas", () => {
    expect(redirectTarget(proxy(request("/staff", {})))).toBe("/login");
    expect(redirectTarget(proxy(request("/dashboard", {})))).toBe("/login");
  });

  it("lets a loan officer into /staff", () => {
    expect(redirectTarget(proxy(request("/staff", { ...session, pv_role: "loan_officer" })))).toBeNull();
  });

  it("keeps a customer out of /staff", () => {
    expect(redirectTarget(proxy(request("/staff", { ...session, pv_role: "customer" })))).toBe("/dashboard");
    expect(redirectTarget(proxy(request("/staff/anything", { ...session, pv_role: "customer" })))).toBe(
      "/dashboard",
    );
  });

  it("treats an unknown role value as not staff", () => {
    expect(redirectTarget(proxy(request("/staff", { ...session, pv_role: "superuser" })))).toBe("/dashboard");
  });

  it("sends staff from the member dashboard to their own area", () => {
    expect(redirectTarget(proxy(request("/dashboard/loans", { ...session, pv_role: "loan_officer" })))).toBe("/staff");
    expect(redirectTarget(proxy(request("/dashboard/loans", { ...session, pv_role: "admin" })))).toBe("/admin");
  });

  it("lets an admin into /admin, and sends them there from the Loan Officer area", () => {
    expect(redirectTarget(proxy(request("/admin", { ...session, pv_role: "admin" })))).toBeNull();
    expect(redirectTarget(proxy(request("/admin/anything", { ...session, pv_role: "admin" })))).toBeNull();
    expect(redirectTarget(proxy(request("/staff", { ...session, pv_role: "admin" })))).toBe("/admin");
  });

  it("keeps loan officers, customers and unknown roles out of /admin", () => {
    expect(redirectTarget(proxy(request("/admin", { ...session, pv_role: "loan_officer" })))).toBe("/staff");
    expect(redirectTarget(proxy(request("/admin/settings", { ...session, pv_role: "customer" })))).toBe("/dashboard");
    expect(redirectTarget(proxy(request("/admin", { ...session, pv_role: "superuser" })))).toBe("/dashboard");
  });

  it("sends anyone without a session to /login from /admin too", () => {
    expect(redirectTarget(proxy(request("/admin", {})))).toBe("/login");
  });

  it("covers the admin area in the matcher", async () => {
    const { config } = await import("./proxy");
    expect(config.matcher).toContain("/admin/:path*");
  });

  it("does not confuse a /staffing-style path with the staff area", () => {
    // Not in the matcher in practice, but the prefix check itself must
    // require a segment boundary.
    expect(redirectTarget(proxy(request("/staffing", { ...session, pv_role: "loan_officer" })))).toBe("/staff");
  });

  it("leaves the decision to the layout when the role cookie is missing", () => {
    expect(redirectTarget(proxy(request("/staff", session)))).toBeNull();
  });
});
