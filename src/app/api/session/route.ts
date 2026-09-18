import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookies, setSessionCookies } from "@/lib/session";

// Called once, right after POST /api/auth/mfa/verify-login succeeds
// client-side. This is the only place the real access/refresh tokens ever
// get persisted - as httpOnly cookies, set server-side, never touched by
// client JS or written to localStorage.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.access_token || !body?.refresh_token || !body?.role) {
    return NextResponse.json({ message: "Missing token payload." }, { status: 400 });
  }

  await setSessionCookies(body.access_token, body.refresh_token, body.role);
  return NextResponse.json({ ok: true });
}

// Logout.
export async function DELETE() {
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
