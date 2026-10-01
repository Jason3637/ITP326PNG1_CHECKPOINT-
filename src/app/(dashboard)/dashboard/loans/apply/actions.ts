"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import { setLastApplicationDraft } from "@/lib/session";
import { TERMS_VERSION } from "@/lib/loan-wizard";
import type {
  DisbursementMethod,
  EmploymentStatus,
  LoanApplication,
  LoanApplyInput,
  PurposeCategory,
  RefereeInput,
} from "@/lib/types";

export type ApplyResult = { ok: true; application: LoanApplication } | { ok: false; error: string };

export interface WizardApplyInput {
  amountRequested: number;
  monthlyIncome: number;
  employmentStatus: EmploymentStatus;
  existingMonthlyDebt: number;
  category: PurposeCategory;
  otherDescription: string;
  disbursementMethod: DisbursementMethod;
  bspMobileNumber: string;
  referee: RefereeInput;
  termsAccepted: boolean;
  confirmedFullName: string;
  confirmedEmail: string;
  confirmedPhoneNumber: string;
  documentIds: number[];
}

// Server Actions are public POST endpoints once deployed (per Next's own
// Server Actions guide) - render-time gating (only showing this form on an
// authenticated page) is not a security boundary, so every field is
// re-validated here regardless of what the client already checked. The
// backend re-validates everything again itself (amount range, referee
// presence, etc.) - this is a first line of defense for a better error
// message, not the authoritative check.
function validate(input: WizardApplyInput): string | null {
  if (!Number.isFinite(input.amountRequested) || input.amountRequested <= 0) {
    return "Enter a valid requested amount.";
  }
  if (input.category === "other" && !input.otherDescription.trim()) {
    return "Describe the loan purpose.";
  }
  if (!input.referee.full_name.trim() || !input.referee.relationship.trim() || !input.referee.mobile_number.trim()) {
    return "Referee full name, relationship, and mobile number are required.";
  }
  if (input.disbursementMethod === "bsp_mobile_banking" && !input.bspMobileNumber.trim()) {
    return "Enter the BSP mobile number to receive disbursement.";
  }
  if (!input.termsAccepted) {
    return "You must confirm the information is accurate and accept the Terms of Service.";
  }
  if (!input.confirmedFullName.trim() || !input.confirmedEmail.trim()) {
    return "Confirm your name and email before submitting.";
  }
  return null;
}

export async function applyForLoan(input: WizardApplyInput): Promise<ApplyResult> {
  const validationError = validate(input);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const body: LoanApplyInput = {
    amount_requested: input.amountRequested,
    purpose_category: input.category,
    purpose: input.category === "other" ? input.otherDescription.trim() : undefined,
    confirmed_full_name: input.confirmedFullName,
    confirmed_email: input.confirmedEmail,
    confirmed_phone_number: input.confirmedPhoneNumber || undefined,
    monthly_income: input.monthlyIncome,
    employment_status: input.employmentStatus,
    existing_monthly_debt: input.existingMonthlyDebt,
    referees: [input.referee],
    disbursement_method_requested: input.disbursementMethod,
    disbursement_account_reference:
      input.disbursementMethod === "bsp_mobile_banking" ? input.bspMobileNumber.trim() : undefined,
    accept_terms: input.termsAccepted,
    policy_version: TERMS_VERSION,
    document_ids: input.documentIds.length > 0 ? input.documentIds : undefined,
  };

  try {
    const application = await serverApiFetch<LoanApplication>("/loans/apply", {
      method: "POST",
      body,
    });

    // Remembered for pre-filling a future application (see session.ts) -
    // deliberately excludes termsAccepted, since accepting the Terms is a
    // per-application decision that must always be made fresh, never
    // carried over silently.
    await setLastApplicationDraft({
      category: input.category,
      otherDescription: input.otherDescription,
      monthlyIncome: String(input.monthlyIncome),
      employmentStatus: input.employmentStatus,
      existingMonthlyDebt: String(input.existingMonthlyDebt),
      disbursementMethod: input.disbursementMethod,
      bspMobileNumber: input.bspMobileNumber,
      refereeFullName: input.referee.full_name,
      refereeRelationship: input.referee.relationship,
      refereeMobile: input.referee.mobile_number,
      refereeEmployer: input.referee.employer_name ?? "",
    });

    return { ok: true, application };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
