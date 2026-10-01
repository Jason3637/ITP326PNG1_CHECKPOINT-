import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookies, setSessionCookies } from "@/lib/session";
import { homePathForRole } from "@/lib/roles";
import type { MeResponse } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Called once, right after POST /api/auth/mfa/verify-login succeeds
// client-side. This is the only place the real access/refresh tokens ever
// get persisted - as httpOnly cookies, set server-side, never touched by
// client JS or written to localStorage.
//
// The role is read back from GET /auth/me using the access token just
// handed over, NOT taken from the request body: the pv_role cookie now
// decides which portal (customer vs staff) a user is routed into, and a
// body field is whatever the browser chose to send. Still routing only -
// the backend enforces the role on every staff endpoint regardless.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.access_token || !body?.refresh_token) {
    return NextResponse.json({ message: "Missing token payload." }, { status: 400 });
  }

  if (!API_URL) {
    return NextResponse.json({ message: "NEXT_PUBLIC_API_URL is not configured." }, { status: 500 });
  }

  let me: MeResponse;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ message: "Couldn't verify the session." }, { status: 401 });
    }
    me = (await res.json()) as MeResponse;
  } catch {
    return NextResponse.json({ message: "Couldn't reach the server." }, { status: 502 });
  }

  await setSessionCookies(body.access_token, body.refresh_token, me.role);
  return NextResponse.json({ ok: true, redirectTo: homePathForRole(me.role) });
}

// Logout.
export async function DELETE() {
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
