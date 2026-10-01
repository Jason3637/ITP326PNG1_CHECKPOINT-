import "server-only";
import { ACCESS_COOKIE, clearSessionCookies, getSessionCookies, updateAccessCookie } from "./session";

// cookies().delete() only works inside a Server Action or Route Handler —
// Next.js throws if it's called during a plain Server Component render
// (confirmed live: every page/layout that calls serverApiFetch renders
// this way). serverApiFetch is called from both contexts, so it can't
// assume it's always safe to mutate cookies here. The tokens are already
// invalid by the time this runs (that's why we're clearing them), so
// failing to clear them immediately in a render context is a harmless
// staleness, not a security issue — they clear on the next real login or
// logout. Swallow just this one Next.js restriction; let the caller's
// UnauthenticatedError (already about to be thrown) drive the actual
// redirect to /login.
async function tryClearSessionCookies() {
  try {
    await clearSessionCookies();
  } catch {
    // Not in a Server Action/Route Handler — nothing more to do here.
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "UnauthenticatedError";
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function rawFetch(path: string, token: string, options: { method?: string; body?: unknown } = {}) {
  // FormData (document uploads) is sent as-is, letting fetch set its own
  // multipart/form-data boundary header — JSON.stringify would mangle a
  // File into "{}" and a hand-set Content-Type would be missing the boundary.
  const isFormData = options.body instanceof FormData;
  return fetch(`${API_URL}/api${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
}

// Server-only authenticated call: reads the access token from the httpOnly
// cookie (never exposed to client JS), calls the Flask backend, and - since
// the backend's access tokens are short-lived - transparently refreshes
// once on a 401 before giving up. Throws UnauthenticatedError when there's
// no valid session at all (no cookie, or refresh also failed), which
// callers use to redirect to /login rather than render broken data.
export async function serverApiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(0, "NEXT_PUBLIC_API_URL is not configured.");
  }

  const { accessToken, refreshToken } = await getSessionCookies();
  if (!accessToken) {
    throw new UnauthenticatedError();
  }

  let res: Response;
  try {
    res = await rawFetch(path, accessToken, options);
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
  }

  if (res.status === 401) {
    if (!refreshToken) {
      await tryClearSessionCookies();
      throw new UnauthenticatedError();
    }

    let refreshRes: Response;
    try {
      refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${refreshToken}` },
        cache: "no-store",
      });
    } catch {
      throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
    }

    if (!refreshRes.ok) {
      await tryClearSessionCookies();
      throw new UnauthenticatedError();
    }

    const { access_token: newAccessToken } = (await refreshRes.json()) as { access_token: string };
    try {
      await updateAccessCookie(newAccessToken);
    } catch {
      // Same render-context restriction as tryClearSessionCookies() above —
      // the refreshed token still gets used for *this* request via the
      // local variable below, it just won't persist to the cookie for
      // subsequent requests until one happens to run in a Server Action or
      // Route Handler instead.
    }

    try {
      res = await rawFetch(path, newAccessToken, options);
    } catch {
      throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, typeof data.message === "string" ? data.message : "Something went wrong.");
  }

  return data as T;
}

// The backend occasionally returns a raw internal field/parameter name in
// its error text (confirmed live: "loan_application_id is not valid for
// this user" from POST /users/documents) — a customer-safety review found
// this rendered verbatim through a couple of server actions. Rather than
// try to predict every backend message that might ever leak something
// internal, this defaults to safe: only messages that read as plain
// sentences (no snake_case identifiers) pass through untouched; anything
// else falls back to a generic, customer-appropriate message. Server
// actions call this on ApiError.message before returning it to the client
// — never render err.message directly.
export function customerSafeMessage(err: ApiError): string {
  if (/[a-z]+_[a-z]+/.test(err.message) || err.message.trim().toLowerCase() === "internal server error") {
    return "Something went wrong. Try again.";
  }
  return err.message;
}

export { ACCESS_COOKIE };
