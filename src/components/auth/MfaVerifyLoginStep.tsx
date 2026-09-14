"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { authApi, ApiError } from "@/lib/api-client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { TokenResponse } from "@/lib/types";

interface MfaVerifyLoginStepProps {
  mfaChallengeToken: string;
  onVerified: (tokens: TokenResponse) => void;
}

export function MfaVerifyLoginStep({ mfaChallengeToken, onVerified }: MfaVerifyLoginStepProps) {
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) {
      setError(useBackupCode ? "Enter a backup code." : "Enter the 6-digit code from your authenticator app.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const tokens = await authApi.mfaVerifyLogin(
        mfaChallengeToken,
        useBackupCode ? { backup_code: value.trim() } : { code: value.trim() },
      );
      onVerified(tokens);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't verify that code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl font-bold tracking-tight text-neutral-900">Enter your code</h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {useBackupCode
          ? "Enter one of your saved backup codes."
          : "Open your authenticator app and enter the current 6-digit code."}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <Input
          label={useBackupCode ? "Backup code" : "6-digit code"}
          inputMode={useBackupCode ? "text" : "numeric"}
          autoComplete="one-time-code"
          value={value}
          onChange={(e) => setValue(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, ""))}
          error={error ?? undefined}
          placeholder={useBackupCode ? "ABCDE-FGHJK" : "123456"}
          maxLength={useBackupCode ? 11 : 6}
        />

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Verifying...
            </>
          ) : (
            "Verify and log in"
          )}
        </Button>

        <button
          type="button"
          onClick={() => {
            setUseBackupCode((prev) => !prev);
            setValue("");
            setError(null);
          }}
          className="rounded text-center text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          {useBackupCode ? "Use my authenticator app instead" : "Use a backup code instead"}
        </button>
      </form>
    </div>
  );
}
