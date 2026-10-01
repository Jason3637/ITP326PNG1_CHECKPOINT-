"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatKina } from "@/lib/utils";
import { getPrimePreview } from "@/lib/actions/prime-pricing";
import type { Profile, PrimePricing } from "@/lib/types";

interface BasicDetailsStepProps {
  profile: Profile;
  amount: string;
  onAmountChange: (value: string) => void;
  onNext: () => void;
}

const DEBOUNCE_MS = 400;

export function BasicDetailsStep({ profile, amount, onAmountChange, onNext }: BasicDetailsStepProps) {
  const [error, setError] = useState<string | undefined>();
  const [preview, setPreview] = useState<PrimePricing | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Guards against a slow earlier request overwriting a faster later one
  // (e.g. typing "1000" fires requests for "1", "10", "100", "1000" - only
  // the response matching the amount currently in the input should ever
  // land in state).
  const latestRequestedAmount = useRef<string>("");

  useEffect(() => {
    const trimmed = amount.trim();
    const amountNum = Number(trimmed);
    const isValid = trimmed !== "" && !Number.isNaN(amountNum) && amountNum > 0;

    // Every state update lives inside the timeout callback rather than the
    // effect body itself (even the "clear" case for an invalid amount) -
    // calling setState synchronously in an effect body triggers cascading
    // renders (react-hooks/set-state-in-effect) - this keeps every update
    // genuinely async, debounced behind the same single timer.
    const timeout = setTimeout(async () => {
      if (!isValid) {
        setPreview(null);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }

      latestRequestedAmount.current = trimmed;
      setPreviewLoading(true);
      const res = await getPrimePreview(amountNum);
      if (latestRequestedAmount.current !== trimmed) return; // a newer request has since superseded this one
      setPreviewLoading(false);
      if (res.ok) {
        setPreview(res.pricing);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(res.error || null);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [amount]);

  function handleContinue() {
    const amountNum = Number(amount);
    if (!amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a loan amount greater than 0.");
      return;
    }
    setError(undefined);
    onNext();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-neutral-900">Basic details</h2>
        <p className="mt-1 text-sm text-neutral-500">Confirm who&apos;s applying and how much you need.</p>
      </div>

      {/* Real data from GET /api/users/profile, read-only — the backend has
          no field for middle/last name, date of birth, employer, or
          residence, and no way to edit a profile at all, so this step
          confirms only what actually exists rather than presenting fields
          that would silently go nowhere. */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Applying as</p>
        <p className="mt-1 text-sm font-medium text-neutral-900">{profile.full_name}</p>
        <p className="text-sm text-neutral-600">{profile.email}</p>
        {profile.phone_number && <p className="text-sm text-neutral-600">{profile.phone_number}</p>}
      </div>

      <Input
        label="Required amount (PGK)"
        type="number"
        inputMode="decimal"
        min={1}
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        error={error}
        placeholder="500"
      />

      {/* Live preview via GET /loans/prime-preview - "the SAME function
          apply() uses" per the backend's own comment on that endpoint, so
          this is a real preview, not a guess, and it's never reused for the
          actual submission (apply() recomputes it itself from
          amount_requested alone). */}
      {previewLoading && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking pricing...
        </div>
      )}

      {!previewLoading && preview && (
        <div className="rounded-lg border border-primary-light bg-primary-light p-3 text-sm">
          <p className="font-semibold text-primary-dark">{preview.category} (preview)</p>
          <div className="mt-1.5 flex flex-col gap-0.5 text-neutral-700">
            <span>Interest: {formatKina(preview.interest_amount)}</span>
            <span>Total repayable: {formatKina(preview.total_repayable)}</span>
            <span>
              Due in {preview.term_days} days, 1 payment of {formatKina(preview.total_repayable)}
            </span>
          </div>
        </div>
      )}

      {!previewLoading && previewError && (
        <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <p>{previewError}</p>
        </div>
      )}

      {!previewLoading && !preview && !previewError && (
        <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <p>Enter an amount to see a live preview of your loan category, interest, and total repayable.</p>
        </div>
      )}

      <Button size="lg" className="mt-2" onClick={handleContinue}>
        Continue
      </Button>
    </div>
  );
}
