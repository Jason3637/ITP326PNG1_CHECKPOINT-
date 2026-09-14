"use client";

import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface BackupCodesStepProps {
  backupCodes: string[];
  onContinue: () => void;
}

export function BackupCodesStep({ backupCodes, onContinue }: BackupCodesStepProps) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl font-bold tracking-tight text-neutral-900">Save your backup codes</h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Use one of these if you ever lose access to your authenticator app. Each code works once.{" "}
        <span className="font-medium text-danger">They will not be shown again.</span>
      </p>

      <ul className="tabular-nums mt-4 grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm text-neutral-900">
        {backupCodes.map((code) => (
          <li key={code} className="rounded bg-white px-2 py-1 text-center shadow-sm">
            {code}
          </li>
        ))}
      </ul>

      <Button size="lg" className="mt-6 w-full" onClick={onContinue}>
        I&apos;ve saved my backup codes
      </Button>
    </div>
  );
}
