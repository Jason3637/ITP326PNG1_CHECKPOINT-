import { describe, expect, it } from "vitest";
import {
  PARAMETER_SPECS,
  parameterDisplay,
  parameterInput,
  parameterPayload,
  validateParameter,
  penaltyPayload,
  penaltyRowsFrom,
  pricingPayload,
  pricingRowsFrom,
  validatePenalty,
  validatePricing,
  type PricingRow,
} from "./admin-settings";

const tiers = [
  { category: "PRIME 1", min_amount: 100, max_amount: 300, interest_rate: 0.5 },
  { category: "PRIME 2", min_amount: 301, max_amount: 650, interest_rate: 0.4 },
  { category: "PRIME 3", min_amount: 651, max_amount: 1000, interest_rate: 0.35 },
];

describe("pricing", () => {
  const rows = pricingRowsFrom(tiers);

  it("round-trips the backend's tiers as percent rows and back", () => {
    expect(rows[2]).toEqual({ category: "PRIME 3", min: "651", max: "1000", ratePct: "35" });
    expect(pricingPayload(rows)).toEqual(tiers);
    expect(validatePricing(rows)).toEqual([]);
  });

  it("requires ranges that follow on, with no gaps or overlaps", () => {
    const gap: PricingRow[] = rows.map((r, i) => (i === 1 ? { ...r, min: "305" } : r));
    expect(validatePricing(gap)).toEqual([
      "Ranges must follow on with no gaps or overlaps: PRIME 1 ends at K300, so PRIME 2 must start at K301.",
    ]);
    const overlap: PricingRow[] = rows.map((r, i) => (i === 2 ? { ...r, min: "600" } : r));
    expect(validatePricing(overlap)[0]).toMatch(/PRIME 3 must start at K651/);
  });

  it("checks whole Kina, rate bounds and unique names", () => {
    expect(validatePricing([{ category: "A", min: "100.5", max: "200", ratePct: "40" }])).toContain("Tier 1: amounts must be whole Kina.");
    expect(validatePricing([{ category: "A", min: "100", max: "200", ratePct: "0" }])).toContain("Tier 1: the interest rate must be above 0% and at most 100%.");
    expect(validatePricing([{ category: "A", min: "100", max: "200", ratePct: "120" }])).toContain("Tier 1: the interest rate must be above 0% and at most 100%.");
    expect(validatePricing([...rows.slice(0, 2), { ...rows[2], category: "prime 1" }])).toContain("Each tier needs its own category name.");
    expect(validatePricing([])).toContain("Have between 1 and 10 tiers.");
  });

  it("sends tiers sorted by amount, rates as fractions without float noise", () => {
    const out = pricingPayload([{ category: "B", min: "301", max: "600", ratePct: "33.33" }, { category: "A", min: "100", max: "300", ratePct: "40" }]);
    expect(out.map((t) => t.category)).toEqual(["A", "B"]);
    expect(out[1].interest_rate).toBe(0.3333);
  });
});

describe("penalties", () => {
  it("round-trips and validates days and percentages", () => {
    const rows = penaltyRowsFrom([
      { tier: 1, days_late: 7, pct_of_original_interest: 0.25 },
      { tier: 2, days_late: 14, pct_of_original_interest: 1 },
    ]);
    expect(rows).toEqual([{ daysLate: "7", pct: "25" }, { daysLate: "14", pct: "100" }]);
    expect(validatePenalty(rows)).toEqual([]);
    expect(penaltyPayload([rows[1], rows[0]])).toEqual([
      { days_late: 7, pct_of_original_interest: 0.25 },
      { days_late: 14, pct_of_original_interest: 1 },
    ]);
    expect(validatePenalty([{ daysLate: "7", pct: "25" }, { daysLate: "7", pct: "50" }])).toContain("Each tier needs a different number of days late.");
    expect(validatePenalty([{ daysLate: "0", pct: "25" }])).toContain("Tier 1: days late must be a whole number, at least 1.");
    expect(validatePenalty([{ daysLate: "7", pct: "1001" }])[0]).toMatch(/at most 1000%/);
  });
});

describe("live settings", () => {
  const [income, dti, months] = PARAMETER_SPECS;

  it("shows and edits each in the admin's units", () => {
    expect(parameterDisplay(income, 200)).toBe("K200");
    expect(parameterDisplay(dti, 0.4)).toBe("40%");
    expect(parameterDisplay(months, 12)).toBe("12 months");
    expect(parameterInput(dti, 0.4)).toBe("40");
    expect(parameterPayload(dti, "35.5")).toBe(0.355);
    expect(parameterPayload(months, "18")).toBe(18);
  });

  it("mirrors the backend's limits", () => {
    expect(validateParameter(income, "0")).toMatch(/more than K0/);
    expect(validateParameter(income, "abc")).toMatch(/enter a number/);
    expect(validateParameter(dti, "100")).toMatch(/below 100%/);
    expect(validateParameter(dti, "0")).toBeNull();
    expect(validateParameter(months, "0")).toMatch(/at least 1/);
    expect(validateParameter(months, "1.5")).toMatch(/whole number/);
    expect(validateParameter(months, "24")).toBeNull();
  });
});
