"use server";

import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import type { LoanApplication, LoanApplyInput } from "@/lib/types";

export type ApplyResult = { ok: true; application: LoanApplication } | { ok: false; error: string };

export async function applyForLoan(input: LoanApplyInput): Promise<ApplyResult> {
  try {
    const application = await serverApiFetch<LoanApplication>("/loans/apply", { method: "POST", body: input });
    return { ok: true, application };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
