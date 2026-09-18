// Client-side calls to the Flask backend, used ONLY for the pre-session
// steps of the auth flow (register, mfa/setup, mfa/verify-setup, login,
// mfa/verify-login). These carry short-lived scoped tokens held in React
// state, never localStorage. Once mfa/verify-login succeeds, the resulting
// access/refresh tokens are handed to POST /api/session (a Next.js route
// handler) to be stored as httpOnly cookies - this client never touches
// them again. Every authenticated call after that point is made
// server-side (see src/lib/server-api.ts), since httpOnly cookies aren't
// readable from client JS and so can't be attached to a client-side fetch.
import type {
  LoginInput,
  LoginResponse,
  MeResponse,
  MfaSetupResponse,
  MfaVerifyLoginInput,
  MfaVerifySetupInput,
  MfaVerifySetupResponse,
  RegisterInput,
  RegisterResponse,
  TokenResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  if (!API_URL) {
    // Fails loudly in dev/build rather than silently calling a relative
    // path that would 404 - NEXT_PUBLIC_API_URL must be set (locally in
    // .env.local, in production in Vercel's project settings).
    throw new ApiError(0, "NEXT_PUBLIC_API_URL is not configured.");
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // Network failure / timeout / DNS / CORS - the backend genuinely can't
    // be reached, distinct from a valid HTTP error response.
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, typeof data.message === "string" ? data.message : "Something went wrong.");
  }

  return data as T;
}

export const authApi = {
  register: (input: RegisterInput) => request<RegisterResponse>("/auth/register", { body: input }),

  mfaSetup: (mfaSetupToken: string) =>
    request<MfaSetupResponse>("/auth/mfa/setup", { method: "POST", token: mfaSetupToken }),

  mfaVerifySetup: (mfaSetupToken: string, input: MfaVerifySetupInput) =>
    request<MfaVerifySetupResponse>("/auth/mfa/verify-setup", { body: input, token: mfaSetupToken }),

  login: (input: LoginInput) => request<LoginResponse>("/auth/login", { body: input }),

  mfaVerifyLogin: (mfaChallengeToken: string, input: MfaVerifyLoginInput) =>
    request<TokenResponse>("/auth/mfa/verify-login", { body: input, token: mfaChallengeToken }),

  me: (accessToken: string) => request<MeResponse>("/auth/me", { method: "GET", token: accessToken }),
};

export { ApiError as default };
