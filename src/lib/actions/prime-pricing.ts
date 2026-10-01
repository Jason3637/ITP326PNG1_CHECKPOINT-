"use server";

import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import type { PrimePricing } from "@/lib/types";

export type PrimePreviewResult = { ok: true; pricing: PrimePricing } | { ok: false; error: string };

// GET /loans/prime-preview - "Lets the frontend show a live category/
// interest/total as the customer types an amount" (the backend's own words
// for this endpoint). Deliberately not reusing customerSafeMessage() here:
// its snake_case heuristic would catch this endpoint's own error text
// (it says "amount_requested must be..."), even though that text isn't an
// internal leak - it's the one documented, customer-safe way the backend
// reports "outside K100-K1,000" or "not a whole-Kina amount". Returning a
// single clean, hand-written message covering both cases is simpler and
// avoids relying on the sanitizer's heuristic matching this case correctly.
export async function getPrimePreview(amountRequested: number): Promise<PrimePreviewResult> {
  if (!Number.isFinite(amountRequested) || amountRequested <= 0) {
    return { ok: false, error: "" };
  }

  try {
    const pricing = await serverApiFetch<PrimePricing>(
      `/loans/prime-preview?amount_requested=${encodeURIComponent(amountRequested)}`,
    );
    return { ok: true, pricing };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session expired. Refresh the page and log in again." };
    }
    if (err instanceof ApiError && err.status === 400) {
      // The only two ways prime_pricing.calculate_prime() raises a 400:
      // outside K100-K1,000, or not a whole-Kina amount. One message covers
      // both plainly enough for a live inline preview.
      return { ok: false, error: "PRIME loans are available from K100 to K1,000, in whole Kina." };
    }
    return { ok: false, error: "Couldn't load a preview right now." };
  }
}
