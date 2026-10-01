"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatKina } from "@/lib/utils";
import type { LoanApplication } from "@/lib/types";

interface ConfirmationScreenProps {
  application: LoanApplication;
}

// Deliberately minimal — only what's asked for (ID, amount, plain-language
// status). No raw status enum, no credit-evaluation internals, no
// officer/admin-facing language.
export function ConfirmationScreen({ application }: ConfirmationScreenProps) {
  const router = useRouter();

  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center sm:p-8">
      <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
      <div>
        <p className="font-display text-xl font-bold tracking-tight text-neutral-900">Application submitted</p>
        <p className="mt-1 text-sm text-neutral-500">Application ID #{application.id}</p>
      </div>

      <div className="mt-2 flex flex-col items-center gap-1">
        <p className="text-3xl font-bold tracking-tight text-neutral-900">{formatKina(application.amount_requested)}</p>
        <p className="text-sm font-medium text-primary">{application.status_label}</p>
      </div>

      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        We&apos;ll review your application and let you know the outcome. You can check its status any time from
        your dashboard.
      </p>

      <Button className="mt-4" onClick={() => router.push("/dashboard")}>
        Back to dashboard
      </Button>
    </Card>
  );
}
