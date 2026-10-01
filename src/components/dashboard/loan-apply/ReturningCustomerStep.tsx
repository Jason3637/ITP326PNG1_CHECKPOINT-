"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DISBURSEMENT_METHODS, EMPLOYMENT_STATUSES, PURPOSE_CATEGORIES } from "@/lib/loan-wizard";
import { formatKina } from "@/lib/utils";
import type { WizardDraft } from "@/lib/session";

function labelFor<T extends { value: string; label: string }>(list: T[], value: string) {
  return list.find((item) => item.value === value)?.label ?? value;
}

interface ReturningCustomerStepProps {
  draft: WizardDraft;
  onUseDraft: () => void;
  onStartFresh: () => void;
}

// Item 2's explicit confirmation requirement, and the only honest option
// given the constraints: there's no backend field to check whether any of
// this is still accurate (no expiry, no "last verified" date on anything),
// so the customer is always asked rather than data being silently reused.
export function ReturningCustomerStep({ draft, onUseDraft, onStartFresh }: ReturningCustomerStepProps) {
  return (
    <Card className="sm:p-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">Welcome back</h1>
      <p className="mt-1 text-sm text-neutral-600">
        We found details from your last application. Are they still correct?
      </p>

      <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-col divide-y divide-neutral-200 text-sm">
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-500">Purpose</span>
            <span className="font-medium text-neutral-900">
              {draft.category === "other" ? `Other — ${draft.otherDescription}` : labelFor(PURPOSE_CATEGORIES, draft.category)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-500">Employment status</span>
            <span className="font-medium text-neutral-900">{labelFor(EMPLOYMENT_STATUSES, draft.employmentStatus)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-500">Gross monthly income</span>
            <span className="font-medium text-neutral-900">{formatKina(Number(draft.monthlyIncome) || 0)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-500">Disbursement method</span>
            <span className="font-medium text-neutral-900">{labelFor(DISBURSEMENT_METHODS, draft.disbursementMethod)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-500">Referee</span>
            <span className="font-medium text-neutral-900">
              {draft.refereeFullName} ({draft.refereeRelationship})
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        Choosing to reuse these fills them in below so you can review and edit anything before submitting — the
        amount, and whether you still have a valid ID and proof of income on file, are confirmed fresh either way.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onUseDraft} className="flex-1">
          Yes, use these details
        </Button>
        <Button variant="outline" size="lg" onClick={onStartFresh} className="flex-1">
          No, start fresh
        </Button>
      </div>
    </Card>
  );
}
