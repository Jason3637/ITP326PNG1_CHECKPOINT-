import { cookies } from "next/headers";

// Server-only. Cookie names/options for the httpOnly session - the access
// and refresh tokens never leave the server after login (no localStorage,
// no client-readable cookie). httpOnly + secure(prod) + sameSite=lax is the
// standard baseline for a token cookie that only this app's own pages need.
export const ACCESS_COOKIE = "pv_access_token";
export const REFRESH_COOKIE = "pv_refresh_token";
export const ROLE_COOKIE = "pv_role"; // not sensitive on its own; lets middleware branch without decoding the JWT

// Pre-filling a *new* application from the customer's last one. There's
// still no backend field for referee/disbursement method (that data lives
// on the application row, but there's no "give me my last application's
// referees" read - only GET /loans/applications/mine, which returns full
// application objects; a future version could read the most recent one's
// referees/disbursement fields directly instead of this cookie). Kept as a
// lightweight client-only convenience for now. Never silently applied - the
// wizard always shows it back to the customer to confirm first (see
// LoanApplyWizard.tsx).
export interface WizardDraft {
  category: string;
  otherDescription: string;
  monthlyIncome: string;
  employmentStatus: string;
  existingMonthlyDebt: string;
  disbursementMethod: string;
  bspMobileNumber: string;
  refereeFullName: string;
  refereeRelationship: string;
  refereeMobile: string;
  refereeEmployer: string;
}

export const LAST_APPLICATION_DRAFT_COOKIE = "pv_last_application_draft";

const isProd = process.env.NODE_ENV === "production";

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function setSessionCookies(accessToken: string, refreshToken: string, role: string) {
  const store = await cookies();
  // Access tokens are short-lived (the backend issues ~1hr access / long-lived
  // refresh, per the JWTs observed live); refresh gets a long ceiling since
  // the backend itself is the real expiry authority.
  store.set(ACCESS_COOKIE, accessToken, cookieOptions(60 * 60));
  store.set(REFRESH_COOKIE, refreshToken, cookieOptions(60 * 60 * 24 * 30));
  store.set(ROLE_COOKIE, role, cookieOptions(60 * 60 * 24 * 30));
}

export async function updateAccessCookie(accessToken: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, cookieOptions(60 * 60));
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(ROLE_COOKIE);
  // Cleared at logout too - a shared device logging in as someone else
  // should never see the previous member's draft.
  store.delete(LAST_APPLICATION_DRAFT_COOKIE);
}

export async function getSessionCookies() {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: store.get(REFRESH_COOKIE)?.value ?? null,
    role: store.get(ROLE_COOKIE)?.value ?? null,
  };
}

export async function setLastApplicationDraft(draft: WizardDraft) {
  const store = await cookies();
  store.set(LAST_APPLICATION_DRAFT_COOKIE, JSON.stringify(draft), cookieOptions(60 * 60 * 24 * 30));
}

export async function getLastApplicationDraft(): Promise<WizardDraft | null> {
  const store = await cookies();
  const raw = store.get(LAST_APPLICATION_DRAFT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WizardDraft;
  } catch {
    return null;
  }
}
