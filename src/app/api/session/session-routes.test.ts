import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const setSessionCookies = vi.fn();
const updateRoleCookie = vi.fn();
vi.mock("@/lib/session", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...real,
    setSessionCookies: (...a: unknown[]) => setSessionCookies(...a),
    updateRoleCookie: (...a: unknown[]) => updateRoleCookie(...a),
    clearSessionCookies: vi.fn(),
  };
});
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});

const fetchMock = vi.fn();

// API_URL is read when the route modules load.
async function loadRoutes() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://backend.test");
  return {
    session: await import("./route"),
    role: await import("./role/route"),
    serverApi: await import("@/lib/server-api"),
  };
}

function loginHandoff(body: unknown) {
  return new NextRequest("http://localhost:3000/api/session", { method: "POST", body: JSON.stringify(body) });
}

function meResponse(role: string, ok = true) {
  return new Response(JSON.stringify(ok ? { id: 1, role, full_name: "X" } : { message: "nope" }), {
    status: ok ? 200 : 401,
  });
}

describe("POST /api/session - login handoff decides the portal from the backend", () => {
  beforeEach(() => {
    setSessionCookies.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ignores a role claimed in the request body and uses /auth/me", async () => {
    const { session } = await loadRoutes();
    fetchMock.mockResolvedValue(meResponse("customer"));
    const res = await session.POST(loginHandoff({ access_token: "a", refresh_token: "r", role: "admin" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/api/auth/me",
      expect.objectContaining({ headers: { Authorization: "Bearer a" } }),
    );
    expect(setSessionCookies).toHaveBeenCalledWith("a", "r", "customer");
    expect(await res.json()).toEqual({ ok: true, redirectTo: "/dashboard" });
  });

  it("sends a loan officer to the staff area", async () => {
    const { session } = await loadRoutes();
    fetchMock.mockResolvedValue(meResponse("loan_officer"));
    const res = await session.POST(loginHandoff({ access_token: "a", refresh_token: "r" }));
    expect(await res.json()).toEqual({ ok: true, redirectTo: "/staff" });
  });

  it("sends an admin to the admin area", async () => {
    const { session } = await loadRoutes();
    fetchMock.mockResolvedValue(meResponse("admin"));
    const res = await session.POST(loginHandoff({ access_token: "a", refresh_token: "r" }));
    expect(setSessionCookies).toHaveBeenCalledWith("a", "r", "admin");
    expect(await res.json()).toEqual({ ok: true, redirectTo: "/admin" });
  });

  it("sets no session when the backend rejects the token", async () => {
    const { session } = await loadRoutes();
    fetchMock.mockResolvedValue(meResponse("x", false));
    const res = await session.POST(loginHandoff({ access_token: "bad", refresh_token: "r" }));
    expect(res.status).toBe(401);
    expect(setSessionCookies).not.toHaveBeenCalled();
  });

  it("rejects a handoff with no tokens", async () => {
    const { session } = await loadRoutes();
    const res = await session.POST(loginHandoff({ role: "admin" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/session/role - re-syncs a stale or edited role cookie", () => {
  beforeEach(() => {
    serverApiFetch.mockReset();
    updateRoleCookie.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const req = () => new NextRequest("http://localhost:3000/api/session/role");

  it("a customer with a forged staff cookie is reset to customer and sent to /dashboard", async () => {
    const { role } = await loadRoutes();
    serverApiFetch.mockResolvedValue({ role: "customer" });
    const res = await role.GET(req());
    expect(updateRoleCookie).toHaveBeenCalledWith("customer");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("loan officers are sent to /staff and admins to /admin", async () => {
    const { role } = await loadRoutes();
    serverApiFetch.mockResolvedValue({ role: "loan_officer" });
    let res = await role.GET(req());
    expect(new URL(res.headers.get("location")!).pathname).toBe("/staff");
    serverApiFetch.mockResolvedValue({ role: "admin" });
    res = await role.GET(req());
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin");
    expect(updateRoleCookie).toHaveBeenLastCalledWith("admin");
  });

  it("no session goes to /login", async () => {
    const { role, serverApi } = await loadRoutes();
    serverApiFetch.mockImplementation(async () => {
      throw new serverApi.UnauthenticatedError();
    });
    const res = await role.GET(req());
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(updateRoleCookie).not.toHaveBeenCalled();
  });
});
