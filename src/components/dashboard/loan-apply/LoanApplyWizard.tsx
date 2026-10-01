"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "./StepIndicator";
import { ReturningCustomerStep } from "./ReturningCustomerStep";
import { BasicDetailsStep } from "./steps/BasicDetailsStep";
import { LoanDetailsStep } from "./steps/LoanDetailsStep";
import { DocumentUploadStep } from "./steps/DocumentUploadStep";
import { ReviewSubmitStep } from "./steps/ReviewSubmitStep";
import { ConfirmationScreen } from "./ConfirmationScreen";
import { applyForLoan, type WizardApplyInput } from "@/app/(dashboard)/dashboard/loans/apply/actions";
import type { IdDocumentType } from "@/lib/loan-wizard";
import type { WizardDraft } from "@/lib/session";
import type {
  Document,
  DisbursementMethod,
  EmploymentStatus,
  LoanApplication,
  Profile,
  PurposeCategory,
} from "@/lib/types";

export interface WizardData {
  amount: string;
  category: PurposeCategory | "";
  otherDescription: string;
  monthlyIncome: string;
  employmentStatus: EmploymentStatus | "";
  existingMonthlyDebt: string;
  disbursementMethod: DisbursementMethod | "";
  bspMobileNumber: string;
  idType: IdDocumentType | "";
  idFile: File | null;
  idSource: "new" | "existing" | "";
  idDocumentId: number | null;
  refereeFullName: string;
  refereeRelationship: string;
  refereeMobile: string;
  refereeEmployer: string;
  incomeFile: File | null;
  incomeSource: "new" | "existing" | "";
  incomeDocumentId: number | null;
  termsAccepted: boolean;
}

const initialData: WizardData = {
  amount: "",
  category: "",
  otherDescription: "",
  monthlyIncome: "",
  employmentStatus: "",
  existingMonthlyDebt: "",
  disbursementMethod: "",
  bspMobileNumber: "",
  idType: "",
  idFile: null,
  idSource: "",
  idDocumentId: null,
  refereeFullName: "",
  refereeRelationship: "",
  refereeMobile: "",
  refereeEmployer: "",
  incomeFile: null,
  incomeSource: "",
  incomeDocumentId: null,
  termsAccepted: false,
};

function dataFromDraft(draft: WizardDraft): WizardData {
  return {
    ...initialData,
    category: draft.category as WizardData["category"],
    otherDescription: draft.otherDescription,
    monthlyIncome: draft.monthlyIncome,
    employmentStatus: draft.employmentStatus as WizardData["employmentStatus"],
    existingMonthlyDebt: draft.existingMonthlyDebt,
    disbursementMethod: draft.disbursementMethod as WizardData["disbursementMethod"],
    bspMobileNumber: draft.bspMobileNumber,
    refereeFullName: draft.refereeFullName,
    refereeRelationship: draft.refereeRelationship,
    refereeMobile: draft.refereeMobile,
    refereeEmployer: draft.refereeEmployer,
  };
}

interface LoanApplyWizardProps {
  profile: Profile;
  draft?: WizardDraft | null;
  existingIdDocument?: Document;
  existingIncomeDocument?: Document;
}

// State lives here, one level above every step - moving between steps never
// discards what was already entered, and a failed upload or a failed final
// submit only shows an inline error on the step where it happened rather
// than resetting anything (see actions.ts for why the wizard only makes
// real API calls at the document-upload and final-submit points, not on
// every step transition).
export function LoanApplyWizard({ profile, draft, existingIdDocument, existingIncomeDocument }: LoanApplyWizardProps) {
  // Gate shown before the wizard itself when a draft exists - never
  // skipped, since reusing a customer's prior details always needs their
  // explicit confirmation first.
  const [prefillResolved, setPrefillResolved] = useState(!draft);
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<LoanApplication | null>(null);

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(0, step - 1));
  }

  async function handleFinalSubmit() {
    if (
      !data.category ||
      !data.employmentStatus ||
      !data.disbursementMethod ||
      !data.termsAccepted
    ) {
      setSubmitError("Please complete every required field before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // Documents already uploaded (POST /users/documents) earlier in the
    // wizard - referenced here by id so submit_application() can link them
    // and check the Proof of Income requirement. Reused ("existing") docs
    // are already linked to this member and don't need re-linking.
    const documentIds = [data.idDocumentId, data.incomeDocumentId].filter(
      (id): id is number => id !== null,
    );

    const input: WizardApplyInput = {
      amountRequested: Number(data.amount),
      monthlyIncome: Number(data.monthlyIncome),
      employmentStatus: data.employmentStatus,
      existingMonthlyDebt: data.existingMonthlyDebt.trim() ? Number(data.existingMonthlyDebt) : 0,
      category: data.category,
      otherDescription: data.otherDescription,
      disbursementMethod: data.disbursementMethod,
      bspMobileNumber: data.bspMobileNumber,
      referee: {
        full_name: data.refereeFullName,
        relationship: data.refereeRelationship,
        mobile_number: data.refereeMobile,
        employer_name: data.refereeEmployer || undefined,
      },
      termsAccepted: data.termsAccepted,
      confirmedFullName: profile.full_name,
      confirmedEmail: profile.email,
      confirmedPhoneNumber: profile.phone_number ?? "",
      documentIds,
    };

    const res = await applyForLoan(input);
    setSubmitting(false);

    if (res.ok) {
      setResult(res.application);
    } else {
      setSubmitError(res.error);
    }
  }

  if (result) {
    return <ConfirmationScreen application={result} />;
  }

  if (!prefillResolved && draft) {
    return (
      <ReturningCustomerStep
        draft={draft}
        onUseDraft={() => {
          setData(dataFromDraft(draft));
          setPrefillResolved(true);
        }}
        onStartFresh={() => setPrefillResolved(true)}
      />
    );
  }

  return (
    <Card className="sm:p-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">Apply for a loan</h1>
      <p className="mt-1 text-sm text-neutral-500">
        We&apos;ll review your application and get back to you. You can only have one open application at a time.
      </p>

      <div className="mt-6">
        <StepIndicator currentStep={currentStep} />
      </div>

      <div className="mt-6">
        {currentStep === 0 && (
          <BasicDetailsStep
            profile={profile}
            amount={data.amount}
            onAmountChange={(v) => update("amount", v)}
            onNext={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 1 && (
          <LoanDetailsStep
            data={data}
            onChange={update}
            onBack={goBack}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <DocumentUploadStep
            data={data}
            amount={Number(data.amount) || 0}
            existingIdDocument={existingIdDocument}
            existingIncomeDocument={existingIncomeDocument}
            onChange={update}
            onBack={goBack}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <ReviewSubmitStep
            data={data}
            profile={profile}
            submitting={submitting}
            submitError={submitError}
            onBack={goBack}
            onSubmit={handleFinalSubmit}
            onTermsAcceptedChange={(v) => update("termsAccepted", v)}
          />
        )}
      </div>
    </Card>
  );
}
