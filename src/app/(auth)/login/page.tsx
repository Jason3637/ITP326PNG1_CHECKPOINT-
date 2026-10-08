"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { MfaSetupStep } from "@/components/auth/MfaSetupStep";
import { BackupCodesStep } from "@/components/auth/BackupCodesStep";
import { MfaVerifyLoginStep } from "@/components/auth/MfaVerifyLoginStep";
import { authApi, ApiError } from "@/lib/api-client";
import { cn, focusRing } from "@/lib/utils";
import type { TokenResponse } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormErrors {
  email?: string;
  password?: string;
}

type Step =
  | { name: "form" }
  | { name: "mfa-challenge"; mfaChallengeToken: string }
  // Registered but never finished enrolling - the backend still requires it.
  | { name: "mfa-setup"; mfaSetupToken: string }
  | { name: "backup-codes"; backupCodes: string[] };

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "form" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setSubmitError(null);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      if (res.mfa_required === "challenge" && res.mfa_challenge_token) {
        setStep({ name: "mfa-challenge", mfaChallengeToken: res.mfa_challenge_token });
      } else if (res.mfa_required === "setup" && res.mfa_setup_token) {
        setStep({ name: "mfa-setup", mfaSetupToken: res.mfa_setup_token });
      } else if (res.message) {
        // The backend's other 403 case (account disabled) has no
        // mfa_required field at all - just a plain message. Surface it
        // directly rather than a generic fallback.
        setSubmitError(res.message);
      } else {
        setSubmitError("Unexpected response from the server. Try again.");
      }
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't log in. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Shared by both the normal MFA challenge and the "just finished setup"
  // path below - exchanges the backend's tokens for our httpOnly session
  // cookie, then enters the area for the user's role - customers to
  // /dashboard, loan officers/admins to /staff. The route handler decides
  // (from the backend's /auth/me), so there's one login for both portals.
  async function completeLogin(tokens: TokenResponse) {
    setFinishing(true);
    setFinishError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        }),
      });
      if (!res.ok) throw new Error("session");
      const { redirectTo } = (await res.json()) as { redirectTo: string };
      router.push(redirectTo);
    } catch {
      setFinishError("Signed in, but couldn't start your session. Try again.");
      setFinishing(false);
    }
  }

  return (
    <Card className="sm:p-8">
      <Logo size="lg" tagline="Your Financial Assistant" preload />

      {step.name === "form" && (
        <>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-neutral-900">Welcome back</h1>
          <p className="mt-1 text-sm text-neutral-500">Welcome to PRIMESTONE. Sign in to manage your loan account.</p>

          <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
            />

            <PasswordInput
              label="Password"
              labelAction={
                <Link
                  href="/forgot-password"
                  className={cn("rounded text-sm font-medium text-primary hover:underline", focusRing)}
                >
                  Forgot password?
                </Link>
              }
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              placeholder="••••••••"
            />

            {submitError && <p className="text-sm text-danger">{submitError}</p>}

            <Button type="submit" size="lg" disabled={loading} className="mt-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Logging in...
                </>
              ) : (
                "Log in"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            New to PRIMESTONE?{" "}
            <Link href="/signup" className={cn("rounded font-medium text-primary hover:underline", focusRing)}>
              Create an account
            </Link>
          </p>
        </>
      )}

      {step.name === "mfa-challenge" && (
        <div className="mt-6">
          <MfaVerifyLoginStep mfaChallengeToken={step.mfaChallengeToken} onVerified={completeLogin} />
          {finishing && <p className="mt-3 text-center text-sm text-neutral-500">Starting your session...</p>}
          {finishError && <p className="mt-3 text-center text-sm text-danger">{finishError}</p>}
        </div>
      )}

      {step.name === "mfa-setup" && (
        <div className="mt-6">
          <p className="mb-4 text-sm text-neutral-500">
            Your account hasn&apos;t finished two-factor setup yet - let&apos;s finish that now.
          </p>
          <MfaSetupStep
            mfaSetupToken={step.mfaSetupToken}
            onVerified={(backupCodes) => setStep({ name: "backup-codes", backupCodes })}
          />
        </div>
      )}

      {step.name === "backup-codes" && (
        <div className="mt-6">
          <BackupCodesStep
            backupCodes={step.backupCodes}
            onContinue={() => setStep({ name: "form" })}
          />
        </div>
      )}
    </Card>
  );
}
