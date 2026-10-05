import type { PenaltyTier, PricingTier, SystemParameterKey } from "./types";

// The deliberately limited set an administrator can change: the PRIME
// pricing table and the late-penalty tiers. Each save creates a new version
// on the backend, for applications submitted from then on. These checks
// mirror the backend's (pricing_policy._parse_*_tiers) so mistakes show
// before saving; the backend checks everything again.

export interface PricingRow {
  category: string;
  min: string; // whole Kina, as typed
  max: string;
  ratePct: string; // percent, as typed ("40" = 40%)
}

export interface PenaltyRow {
  daysLate: string;
  pct: string; // percent of the original interest, as typed
}

const NUM = /^\d+(\.\d+)?$/;
const INT = /^\d+$/;

export function pricingRowsFrom(tiers: PricingTier[]): PricingRow[] {
  return tiers.map((t) => ({
    category: t.category,
    min: String(t.min_amount),
    max: String(t.max_amount),
    ratePct: String(Math.round(t.interest_rate * 10000) / 100),
  }));
}

export function penaltyRowsFrom(tiers: PenaltyTier[]): PenaltyRow[] {
  return tiers.map((t) => ({ daysLate: String(t.days_late), pct: String(Math.round(t.pct_of_original_interest * 10000) / 100) }));
}

// Percent text -> fraction, without float noise (40 -> 0.4, 33.33 -> 0.3333).
function fraction(pct: string): number {
  return Math.round(Number(pct) * 100) / 10000;
}

export function validatePricing(rows: PricingRow[]): string[] {
  const errors: string[] = [];
  if (rows.length < 1 || rows.length > 10) errors.push("Have between 1 and 10 tiers.");
  rows.forEach((r, i) => {
    const n = `Tier ${i + 1}`;
    const name = r.category.trim();
    if (!name) errors.push(`${n}: give it a category name.`);
    else if (name.length > 20) errors.push(`${n}: keep the name to 20 characters.`);
    if (!INT.test(r.min.trim()) || !INT.test(r.max.trim())) errors.push(`${n}: amounts must be whole Kina.`);
    else if (Number(r.min) < 1 || Number(r.max) < Number(r.min)) errors.push(`${n}: the lowest amount must be at least K1 and no more than the highest.`);
    if (!NUM.test(r.ratePct.trim()) || Number(r.ratePct) <= 0 || Number(r.ratePct) > 100) {
      errors.push(`${n}: the interest rate must be above 0% and at most 100%.`);
    }
  });
  const names = rows.map((r) => r.category.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) errors.push("Each tier needs its own category name.");
  if (errors.length === 0) {
    const sorted = [...rows].sort((a, b) => Number(a.min) - Number(b.min));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      if (Number(sorted[i].min) !== Number(prev.max) + 1) {
        errors.push(
          `Ranges must follow on with no gaps or overlaps: ${prev.category.trim()} ends at K${Number(prev.max).toLocaleString("en-US")}, so ${sorted[i].category.trim()} must start at K${(Number(prev.max) + 1).toLocaleString("en-US")}.`,
        );
      }
    }
  }
  return errors;
}

export function validatePenalty(rows: PenaltyRow[]): string[] {
  const errors: string[] = [];
  if (rows.length < 1 || rows.length > 5) errors.push("Have between 1 and 5 tiers.");
  rows.forEach((r, i) => {
    const n = `Tier ${i + 1}`;
    if (!INT.test(r.daysLate.trim()) || Number(r.daysLate) < 1) errors.push(`${n}: days late must be a whole number, at least 1.`);
    if (!NUM.test(r.pct.trim()) || Number(r.pct) <= 0 || Number(r.pct) > 1000) {
      errors.push(`${n}: the penalty must be above 0% and at most 1000% of the original interest.`);
    }
  });
  const days = rows.map((r) => r.daysLate.trim()).filter(Boolean);
  if (new Set(days).size !== days.length) errors.push("Each tier needs a different number of days late.");
  return errors;
}

export function pricingPayload(rows: PricingRow[]): Omit<PricingTier, never>[] {
  return [...rows]
    .sort((a, b) => Number(a.min) - Number(b.min))
    .map((r) => ({ category: r.category.trim(), min_amount: Number(r.min), max_amount: Number(r.max), interest_rate: fraction(r.ratePct) }));
}

export function penaltyPayload(rows: PenaltyRow[]): { days_late: number; pct_of_original_interest: number }[] {
  return [...rows]
    .sort((a, b) => Number(a.daysLate) - Number(b.daysLate))
    .map((r) => ({ days_late: Number(r.daysLate), pct_of_original_interest: fraction(r.pct) }));
}

export function formatPct(fractionValue: number): string {
  return `${Math.round(fractionValue * 10000) / 100}%`;
}

export const NOTE_MAX_LENGTH = 500;

export const CHANGE_WARNING =
  "Changes apply only to applications submitted after you save. Applications already submitted keep the price they were quoted, and existing loans keep their terms and penalty policy - nothing already quoted or disbursed is ever repriced.";

// ---- the three live settings (PUT /admin/parameters) -------------------------
// Each is read when the work it governs happens, so a change never reaches
// back: credit notes already produced and verifications already given keep
// what they were made with.
export interface ParameterSpec {
  key: SystemParameterKey;
  label: string;
  unit: "kina" | "percent" | "months";
  effect: string;
}

export const PARAMETER_SPECS: ParameterSpec[] = [
  {
    key: "min_monthly_income",
    label: "Minimum monthly income",
    unit: "kina",
    effect:
      "Used in the advisory credit notes on applications submitted (or re-checked) after the change. It never approves or rejects anything.",
  },
  {
    key: "max_debt_to_income_ratio",
    label: "Maximum debt-to-income",
    unit: "percent",
    effect:
      "Existing monthly debt plus the new repayment, as a share of monthly income. Used in the advisory credit notes on applications submitted (or re-checked) after the change. It never approves or rejects anything.",
  },
  {
    key: "customer_verification_validity_months",
    label: "Customer verification lasts",
    unit: "months",
    effect:
      "How long a customer's identity verification stays valid (never past their ID's expiry). Applies to customers verified after the change; existing verifications keep their expiry date.",
  },
];

// The value as the admin types it: percent for the ratio, whole months.
export function parameterInput(spec: ParameterSpec, value: number): string {
  return spec.unit === "percent" ? String(Math.round(value * 10000) / 100) : String(value);
}

export function parameterDisplay(spec: ParameterSpec, value: number): string {
  if (spec.unit === "kina") return `K${value.toLocaleString("en-US")}`;
  if (spec.unit === "percent") return `${Math.round(value * 10000) / 100}%`;
  return value === 1 ? "1 month" : `${value} months`;
}

// Mirrors the backend: money > 0; the ratio 0 <= x < 1 (0-100%); months >= 1.
export function validateParameter(spec: ParameterSpec, text: string): string | null {
  const t = text.trim();
  if (spec.unit === "months") {
    return /^\d+$/.test(t) && Number(t) >= 1 ? null : `${spec.label}: enter a whole number of months, at least 1.`;
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return `${spec.label}: enter a number.`;
  if (spec.unit === "kina" && Number(t) <= 0) return `${spec.label}: must be more than K0.`;
  if (spec.unit === "percent" && Number(t) >= 100) return `${spec.label}: must be below 100%.`;
  return null;
}

// What PUT /admin/parameters takes: only the changed keys, in the backend's units.
export function parameterPayload(spec: ParameterSpec, text: string): number {
  const n = Number(text.trim());
  return spec.unit === "percent" ? Math.round(n * 100) / 10000 : spec.unit === "months" ? Math.trunc(n) : n;
}
