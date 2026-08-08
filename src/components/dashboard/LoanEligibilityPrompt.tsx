import Link from "next/link";
import { HandCoins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatKina } from "@/lib/utils";

interface LoanEligibilityPromptProps {
  eligibleAmount: number;
}

export function LoanEligibilityPrompt({ eligibleAmount }: LoanEligibilityPromptProps) {
  return (
    <Card className="animate-card-enter flex h-full flex-col items-start gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary-dark">
        <HandCoins className="h-5 w-5" aria-hidden="true" />
      </span>

      <div>
        <p className="font-semibold text-neutral-900">No active loan</p>
        <p className="mt-1 text-sm text-neutral-500">
          You&apos;re eligible for up to <span className="font-medium text-neutral-900">{formatKina(eligibleAmount)}</span> based
          on your savings history.
        </p>
      </div>

      <Link
        href="/dashboard/loans/apply"
        className="mt-auto inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Check loan eligibility
      </Link>
    </Card>
  );
}
