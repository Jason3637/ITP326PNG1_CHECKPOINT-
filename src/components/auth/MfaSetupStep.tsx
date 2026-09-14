"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, ShieldCheck } from "lucide-react";
import { authApi, ApiError } from "@/lib/api-client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { MfaSetupResponse } from "@/lib/types";

interface MfaSetupStepProps {
  mfaSetupToken: string;
  onVerified: (backupCodes: string[]) => void;
}

// Shared by Sign-Up (every new member enrolls in MFA) and the Login flow's
// "not enrolled yet" edge case (mfa_required === "setup") - same backend
// scope (mfa_setup_token), same two calls (mfa/setup then mfa/verify-setup).
export function MfaSetupStep({ mfaSetupToken, onVerified }: MfaSetupStepProps) {
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .mfaSetup(mfaSetupToken)
      .then((res) => {
        if (!cancelled) setSetup(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Couldn't start MFA setup.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mfaSetupToken]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setSubmitError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authApi.mfaVerifySetup(mfaSetupToken, { code: code.trim() });
      onVerified(res.backup_codes);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't verify that code.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return <p className="text-sm text-danger">{loadError}</p>;
  }

  if (!setup) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-neutral-500">Setting up two-factor authentication...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl font-bold tracking-tight text-neutral-900">Set up two-factor login</h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Prime&apos;s Vault requires an authenticator app (e.g. Google Authenticator, Authy) for every account. Scan
        the QR code below, then enter the 6-digit code it shows.
      </p>

      <div className="mt-4 flex justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <Image src={setup.qr_code_png} alt="MFA setup QR code" width={200} height={200} unoptimized />
      </div>

      <details className="mt-3 text-sm text-neutral-500">
        <summary className="cursor-pointer font-medium text-neutral-700">Can&apos;t scan the code?</summary>
        <p className="mt-1">Enter this key manually in your authenticator app:</p>
        <p className="tabular-nums mt-1 break-all rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-900">
          {setup.totp_secret}
        </p>
      </details>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <Input
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          error={submitError ?? undefined}
          placeholder="123456"
        />
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Verifying...
            </>
          ) : (
            "Verify and enable MFA"
          )}
        </Button>
      </form>
    </div>
  );
}
