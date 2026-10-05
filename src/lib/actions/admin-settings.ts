"use server";

import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import {
  NOTE_MAX_LENGTH,
  PARAMETER_SPECS,
  parameterPayload,
  validateParameter,
  penaltyPayload,
  pricingPayload,
  validatePenalty,
  validatePricing,
  type PenaltyRow,
  type PricingRow,
} from "@/lib/admin-settings";
import type { PolicyVersions, PricingTier, PenaltyTier, SystemParameterKey } from "@/lib/types";

export type SaveResult = { ok: true; label: string } | { ok: false; error: string };

// The backend's 400s name its fields (tiers[0].interest_rate, ...). Field
// names and indexes are reworded; the sentence is otherwise kept, because
// it says exactly what's wrong.
function backendError(err: ApiError): string {
  return err.message
    .replace(/tiers\[(\d+)\]\.?/g, (_, i) => `Tier ${Number(i) + 1}: `)
    .replace(/min_amount/g, "lowest amount")
    .replace(/max_amount/g, "highest amount")
    .replace(/interest_rate/g, "interest rate")
    .replace(/pct_of_original_interest/g, "penalty percentage")
    .replace(/days_late/g, "days late")
    .replace(/:\s+:/g, ":");
}

function failure(err: unknown): SaveResult {
  if (err instanceof UnauthenticatedError) return { ok: false, error: "Your session expired. Refresh the page and log in again." };
  if (err instanceof ApiError) {
    if (err.status === 403) return { ok: false, error: "Only an administrator can change pricing or penalties." };
    if (err.status === 400) return { ok: false, error: backendError(err) };
    return { ok: false, error: "The change wasn't saved. Try again." };
  }
  return { ok: false, error: "The change wasn't saved. Try again." };
}

function cleanNote(note: unknown): string | null {
  const n = typeof note === "string" ? note.trim() : "";
  return n ? n.slice(0, NOTE_MAX_LENGTH) : null;
}

// POST /admin/pricing - a new PRIME pricing version, current from now on
// for NEW applications only (audited with before/after on the backend).
export async function savePricing(rows: PricingRow[], note: string): Promise<SaveResult> {
  if (!Array.isArray(rows)) return { ok: false, error: "Nothing to save." };
  const errors = validatePricing(rows);
  if (errors.length) return { ok: false, error: errors[0] };
  try {
    const res = await serverApiFetch<PolicyVersions<PricingTier>>("/admin/pricing", {
      method: "POST",
      body: { tiers: pricingPayload(rows), note: cleanNote(note) },
    });
    return { ok: true, label: res.current.label };
  } catch (err) {
    return failure(err);
  }
}

// POST /admin/penalty-policy - a new late-penalty version, for applications
// submitted from now on.
export async function savePenaltyPolicy(rows: PenaltyRow[], note: string): Promise<SaveResult> {
  if (!Array.isArray(rows)) return { ok: false, error: "Nothing to save." };
  const errors = validatePenalty(rows);
  if (errors.length) return { ok: false, error: errors[0] };
  try {
    const res = await serverApiFetch<PolicyVersions<PenaltyTier>>("/admin/penalty-policy", {
      method: "POST",
      body: { tiers: penaltyPayload(rows), note: cleanNote(note) },
    });
    return { ok: true, label: res.current.label };
  } catch (err) {
    return failure(err);
  }
}

// PUT /admin/parameters with only the changed settings (audited before/after
// on the backend). Values arrive as typed; converted to the backend's units.
export async function saveParameters(changes: Partial<Record<SystemParameterKey, string>>): Promise<SaveResult> {
  const body: Partial<Record<SystemParameterKey, number>> = {};
  for (const spec of PARAMETER_SPECS) {
    const text = changes?.[spec.key];
    if (typeof text !== "string") continue;
    const invalid = validateParameter(spec, text);
    if (invalid) return { ok: false, error: invalid };
    body[spec.key] = parameterPayload(spec, text);
  }
  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing has changed." };
  try {
    await serverApiFetch("/admin/parameters", { method: "PUT", body });
    return { ok: true, label: "settings" };
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      const spec = PARAMETER_SPECS.find((p) => err.message.includes(p.key));
      return { ok: false, error: spec ? `${spec.label}: that value isn't allowed.` : "That value isn't allowed." };
    }
    return failure(err);
  }
}
