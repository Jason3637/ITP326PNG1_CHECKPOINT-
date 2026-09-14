import "server-only";
import { ACCESS_COOKIE, clearSessionCookies, getSessionCookies, updateAccessCookie } from "./session";

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
  return fetch(`${API_URL}/api${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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
      await clearSessionCookies();
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
      await clearSessionCookies();
      throw new UnauthenticatedError();
    }

    const { access_token: newAccessToken } = (await refreshRes.json()) as { access_token: string };
    await updateAccessCookie(newAccessToken);

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

export { ACCESS_COOKIE };
