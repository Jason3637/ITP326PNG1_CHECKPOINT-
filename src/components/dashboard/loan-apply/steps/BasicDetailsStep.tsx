"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Profile } from "@/lib/types";

interface BasicDetailsStepProps {
  profile: Profile;
  amount: string;
  onAmountChange: (value: string) => void;
  onNext: () => void;
}

export function BasicDetailsStep({ profile, amount, onAmountChange, onNext }: BasicDetailsStepProps) {
  const [error, setError] = useState<string | undefined>();

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
        placeholder="5000"
      />

      <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <p>
          Your loan category, interest rate, and total repayable amount are calculated once you submit your
          complete application in the final step — Prime&apos;s Vault doesn&apos;t pre-calculate terms before
          then.
        </p>
      </div>

      <Button size="lg" className="mt-2" onClick={handleContinue}>
        Continue
      </Button>
    </div>
  );
}
