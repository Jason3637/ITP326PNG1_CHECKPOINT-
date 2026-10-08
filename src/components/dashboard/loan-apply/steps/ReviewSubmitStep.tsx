"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { formatKina } from "@/lib/utils";
import {
  DISBURSEMENT_METHODS,
  EMPLOYMENT_STATUSES,
  ID_DOCUMENT_TYPES,
  PROOF_OF_INCOME_THRESHOLD,
  PURPOSE_CATEGORIES,
  TERMS_VERSION,
} from "@/lib/loan-wizard";
import type { Profile } from "@/lib/types";
import type { WizardData } from "../LoanApplyWizard";

function labelFor<T extends { value: string; label: string }>(list: T[], value: string) {
  return list.find((item) => item.value === value)?.label ?? value;
}

interface ReviewSubmitStepProps {
  data: WizardData;
  profile: Profile;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onSubmit: () => void;
  onTermsAcceptedChange: (value: boolean) => void;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className="text-right font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function idDocumentValue(data: WizardData): string {
  if (data.idSource === "existing") return "Using document on file";
  return `${labelFor(ID_DOCUMENT_TYPES, data.idType)} — ${data.idFile?.name ?? ""}`;
}

function incomeDocumentValue(data: WizardData, incomeRequired: boolean): string {
  if (data.incomeSource === "existing") return "Using document on file";
  if (data.incomeFile) return data.incomeFile.name;
  return incomeRequired ? "Missing" : "Not required";
}

export function ReviewSubmitStep({
  data,
  profile,
  submitting,
  submitError,
  onBack,
  onSubmit,
  onTermsAcceptedChange,
}: ReviewSubmitStepProps) {
  const amountNum = Number(data.amount) || 0;
  const incomeRequired = amountNum >= PROOF_OF_INCOME_THRESHOLD;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-neutral-900">Review &amp; submit</h2>
        <p className="mt-1 text-sm text-neutral-600">Check your details before submitting your application.</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">Applicant</p>
        <div className="divide-y divide-neutral-200">
          <SummaryRow label="Name" value={profile.full_name} />
          <SummaryRow label="Mobile" value={profile.phone_number ?? "Not on file"} />
          <SummaryRow label="Employment status" value={labelFor(EMPLOYMENT_STATUSES, data.employmentStatus)} />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">Loan</p>
        <div className="divide-y divide-neutral-200">
          <SummaryRow label="Requested amount" value={formatKina(amountNum)} />
          <SummaryRow
            label="Category"
            value={
              data.category === "other" ? `Other — ${data.otherDescription}` : labelFor(PURPOSE_CATEGORIES, data.category)
            }
          />
          <SummaryRow label="Term" value="14 days (PRIME)" />
          <SummaryRow label="Gross monthly income" value={formatKina(Number(data.monthlyIncome) || 0)} />
          <SummaryRow
            label="Disbursement method"
            value={
              data.disbursementMethod === "bsp_mobile_banking"
                ? `${labelFor(DISBURSEMENT_METHODS, data.disbursementMethod)} (${data.bspAccountNumber})`
                : labelFor(DISBURSEMENT_METHODS, data.disbursementMethod)
            }
          />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">Documents &amp; referee</p>
        <div className="divide-y divide-neutral-200">
          <SummaryRow label="ID document" value={idDocumentValue(data)} />
          <SummaryRow label="Referee" value={`${data.refereeFullName} (${data.refereeRelationship})`} />
          <SummaryRow label="Proof of income" value={incomeDocumentValue(data, incomeRequired)} />
        </div>
      </div>

      <p className="text-xs text-neutral-600">
        Your interest rate, total repayable amount, and eligibility result are calculated once you submit — they
        aren&apos;t shown above because PRIMESTONE doesn&apos;t pre-calculate them.
      </p>

      <Checkbox
        label={`I confirm the information above is accurate and I accept PRIMESTONE's Terms of Service (${TERMS_VERSION}).`}
        checked={data.termsAccepted}
        onChange={(e) => onTermsAcceptedChange(e.target.checked)}
      />

      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      <div className="mt-2 flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} disabled={submitting} className="w-20 shrink-0">
          Back
        </Button>
        <Button
          size="lg"
          onClick={onSubmit}
          disabled={submitting || !data.termsAccepted}
          className="flex-1"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Submitting...
            </>
          ) : (
            "Submit application"
          )}
        </Button>
      </div>
    </div>
  );
}
