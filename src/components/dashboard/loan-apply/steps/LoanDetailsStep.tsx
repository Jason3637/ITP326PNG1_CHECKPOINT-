"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  DISBURSEMENT_METHODS,
  EMPLOYMENT_STATUSES,
  PRIME_TERM_DAYS,
  PURPOSE_CATEGORIES, EMPLOYER_NAME_MAX_LENGTH, RESIDENTIAL_ADDRESS_MAX_LENGTH, employerRequired } from "@/lib/loan-wizard";
import type { WizardData } from "../LoanApplyWizard";

const selectClass = cn(
  "h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
);

interface LoanDetailsStepProps {
  data: WizardData;
  onChange: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  onBack: () => void;
  onNext: () => void;
}

interface FormErrors {
  category?: string;
  otherDescription?: string;
  monthlyIncome?: string;
  employmentStatus?: string;
  residentialAddress?: string;
  employerName?: string;
  existingMonthlyDebt?: string;
  disbursementMethod?: string;
  bspAccountNumber?: string;
}

export function LoanDetailsStep({ data, onChange, onBack, onNext }: LoanDetailsStepProps) {
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!data.category) next.category = "Select the purpose of this loan.";
    if (data.category === "other" && !data.otherDescription.trim()) {
      next.otherDescription = "Describe the loan purpose.";
    }

    const incomeNum = Number(data.monthlyIncome);
    if (!data.monthlyIncome.trim() || Number.isNaN(incomeNum) || incomeNum <= 0) {
      next.monthlyIncome = "Enter your gross monthly income.";
    }

    if (!data.employmentStatus) next.employmentStatus = "Select your employment status.";

    if (!data.residentialAddress.trim()) next.residentialAddress = "Enter where you live.";
    else if (data.residentialAddress.trim().length > RESIDENTIAL_ADDRESS_MAX_LENGTH) {
      next.residentialAddress = `Keep your address under ${RESIDENTIAL_ADDRESS_MAX_LENGTH} characters.`;
    }
    if (employerRequired(data.employmentStatus) && !data.employerName.trim()) {
      next.employerName =
        data.employmentStatus === "self_employed" ? "Enter your business name." : "Enter your employer's name.";
    } else if (data.employerName.trim().length > EMPLOYER_NAME_MAX_LENGTH) {
      next.employerName = `Keep this under ${EMPLOYER_NAME_MAX_LENGTH} characters.`;
    }

    if (data.existingMonthlyDebt.trim()) {
      const debtNum = Number(data.existingMonthlyDebt);
      if (Number.isNaN(debtNum) || debtNum < 0) next.existingMonthlyDebt = "Enter a valid amount, or leave blank.";
    }

    if (!data.disbursementMethod) next.disbursementMethod = "Select how you'd like to receive funds.";
    if (data.disbursementMethod === "bsp_mobile_banking" && !data.bspAccountNumber.trim()) {
      next.bspAccountNumber = "Enter the BSP account number to receive disbursement.";
    }

    return next;
  }

  function handleContinue() {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length === 0) onNext();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-neutral-900">Loan details</h2>
        <p className="mt-1 text-sm text-neutral-500">Tell us why you need the loan and how you&apos;d repay it.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="purpose-category" className="text-sm font-medium text-neutral-700">
          Purpose of loan
        </label>
        <select
          id="purpose-category"
          value={data.category}
          onChange={(e) => onChange("category", e.target.value as WizardData["category"])}
          className={selectClass}
        >
          <option value="" disabled>
            Select a purpose
          </option>
          {PURPOSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {errors.category && <p className="text-sm text-danger">{errors.category}</p>}
      </div>

      {data.category === "other" && (
        <Input
          label="Describe the purpose"
          value={data.otherDescription}
          onChange={(e) => onChange("otherDescription", e.target.value)}
          error={errors.otherDescription}
          placeholder="e.g. Home repairs after storm damage"
        />
      )}

      <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <p>Every PRIME loan is repaid in a single payment {PRIME_TERM_DAYS} days after disbursement.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Gross monthly income (PGK)"
          type="number"
          inputMode="decimal"
          min={0}
          value={data.monthlyIncome}
          onChange={(e) => onChange("monthlyIncome", e.target.value)}
          error={errors.monthlyIncome}
          placeholder="800"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="employment-status" className="text-sm font-medium text-neutral-700">
            Employment status
          </label>
          <select
            id="employment-status"
            value={data.employmentStatus}
            onChange={(e) => onChange("employmentStatus", e.target.value as WizardData["employmentStatus"])}
            className={selectClass}
          >
            <option value="" disabled>
              Select employment status
            </option>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {errors.employmentStatus && <p className="text-sm text-danger">{errors.employmentStatus}</p>}
        </div>
      </div>

      {employerRequired(data.employmentStatus) && (
        <Input
          label={data.employmentStatus === "self_employed" ? "Business name" : "Employer"}
          value={data.employerName}
          maxLength={EMPLOYER_NAME_MAX_LENGTH}
          onChange={(e) => onChange("employerName", e.target.value)}
          error={errors.employerName}
          placeholder={data.employmentStatus === "self_employed" ? "e.g. Kaupa Market Stall" : "e.g. Bank South Pacific"}
        />
      )}

      <Input
        label="Residential address"
        value={data.residentialAddress}
        maxLength={RESIDENTIAL_ADDRESS_MAX_LENGTH}
        onChange={(e) => onChange("residentialAddress", e.target.value)}
        error={errors.residentialAddress}
        placeholder="e.g. Section 12, Lot 4, Gerehu Stage 2, Port Moresby, NCD"
      />

      <Input
        label="Existing monthly debt (PGK, optional)"
        type="number"
        inputMode="decimal"
        min={0}
        value={data.existingMonthlyDebt}
        onChange={(e) => onChange("existingMonthlyDebt", e.target.value)}
        error={errors.existingMonthlyDebt}
        placeholder="0"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="disbursement-method" className="text-sm font-medium text-neutral-700">
          Disbursement method
        </label>
        <select
          id="disbursement-method"
          value={data.disbursementMethod}
          onChange={(e) => onChange("disbursementMethod", e.target.value as WizardData["disbursementMethod"])}
          className={selectClass}
        >
          <option value="" disabled>
            Select how you&apos;d like to receive funds
          </option>
          {DISBURSEMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {errors.disbursementMethod && <p className="text-sm text-danger">{errors.disbursementMethod}</p>}
      </div>

      {data.disbursementMethod === "bsp_mobile_banking" && (
        <Input
          label="BSP account number"
          inputMode="numeric"
          value={data.bspAccountNumber}
          onChange={(e) => onChange("bspAccountNumber", e.target.value)}
          error={errors.bspAccountNumber}
          placeholder="e.g. 1001234567"
        />
      )}

      <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <p>Your official interest rate, total repayable amount, and eligibility result appear after you submit.</p>
      </div>

      <div className="mt-2 flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button size="lg" onClick={handleContinue} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
