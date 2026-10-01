"use server";

import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import type { PaymentTransaction, ReportPaymentInput } from "@/lib/types";

export type ReportPaymentResult =
  | { ok: true; transaction: PaymentTransaction }
  | { ok: false; error: string };

// POST /api/payments/repay - creates a REPORTED transaction only; the
// backend never touches the ledger here (see
// app/services/payment_processing.py's module docstring) - only an admin's
// later /verify call can do that. This replaces the previous integration's
// workaround of uploading a receipt document with the amount/date/method
// encoded into the filename - the real endpoint accepts all of that
// directly now.
export async function reportRepayment(input: ReportPaymentInput): Promise<ReportPaymentResult> {
  try {
    const { transaction } = await serverApiFetch<{ transaction: PaymentTransaction }>("/payments/repay", {
      method: "POST",
      body: input,
    });
    return { ok: true, transaction };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      return { ok: false, error: customerSafeMessage(err) };
    }
    return { ok: false, error: "Couldn't submit your report. Try again." };
  }
}
