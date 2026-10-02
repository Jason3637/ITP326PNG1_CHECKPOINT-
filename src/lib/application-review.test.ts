import { describe, expect, it } from "vitest";
import {
  ageFromDob,
  formatDob,
  formatReviewDateTime,
  parseBackendTimestamp,
  relevantEarlierVersions,
  toCreditAdvisory,
} from "./application-review";
import type { ReviewDocument } from "./types";

// Shaped exactly like the backend's credit_evaluation.evaluate() output.
const rawCreditResult = {
  algorithm: "interim-v2",
  disclaimer: "Interim underwriting model.",
  evaluated_at: "2026-09-28T01:00:00+00:00",
  score: 35,
  eligible: false,
  insufficient_data: false,
  requested_amount: 700,
  max_eligible_amount: 350,
  reasons: ["Member account is less than 30 days old - limited track record."],
  recommendation: "decline",
  criteria_checked: ["minimum_income", "membership_tenure"],
};

describe("toCreditAdvisory", () => {
  it("keeps only the explanatory fields - never the score, verdict or cap", () => {
    const advisory = toCreditAdvisory(rawCreditResult);
    expect(advisory).toEqual({
      algorithm: "interim-v2",
      disclaimer: "Interim underwriting model.",
      evaluated_at: "2026-09-28T01:00:00+00:00",
      insufficient_data: false,
      reasons: ["Member account is less than 30 days old - limited track record."],
      criteria_checked: ["minimum_income", "membership_tenure"],
    });
    const keys = Object.keys(advisory!);
    for (const banned of ["score", "eligible", "recommendation", "max_eligible_amount", "requested_amount"]) {
      expect(keys).not.toContain(banned);
    }
  });

  it("returns null for a missing result and tolerates malformed fields", () => {
    expect(toCreditAdvisory(null)).toBeNull();
    expect(toCreditAdvisory("nope")).toBeNull();
    expect(toCreditAdvisory({ reasons: [1, "ok"], criteria_checked: "x" })).toMatchObject({
      reasons: ["ok"],
      criteria_checked: [],
      insufficient_data: false,
    });
  });
});

describe("ageFromDob", () => {
  const today = new Date(2026, 9, 2); // Oct 2, 2026 (local)

  it("counts completed years only", () => {
    expect(ageFromDob("1990-10-02", today)).toBe(36);
    expect(ageFromDob("1990-10-03", today)).toBe(35);
    expect(ageFromDob("2008-01-15", today)).toBe(18);
  });

  it("handles missing and malformed dates", () => {
    expect(ageFromDob(null, today)).toBeNull();
    expect(ageFromDob("01/05/1990", today)).toBeNull();
    expect(ageFromDob("2030-01-01", today)).toBeNull();
  });
});

describe("formatDob", () => {
  it("never shifts the calendar day", () => {
    expect(formatDob("1990-05-01")).toBe("May 1, 1990");
  });
});

describe("relevantEarlierVersions", () => {
  const doc = (overrides: Partial<ReviewDocument>): ReviewDocument => ({
    id: 1,
    loan_application_id: 12,
    document_type: "proof_of_income",
    uploaded_at: "2026-09-01T00:00:00Z",
    is_current: false,
    superseded_by_id: 2,
    linked_to_this_application: false,
    ...overrides,
  });

  it("keeps superseded documents for this application and ID documents only", () => {
    const docs = [
      doc({ id: 1 }), // earlier payslip for this application - kept
      doc({ id: 2, is_current: true, superseded_by_id: null }), // current - not history
      doc({ id: 3, loan_application_id: 99 }), // another application - dropped
      doc({ id: 4, loan_application_id: null, document_type: "id_verification" }), // old ID - kept
      doc({ id: 5, loan_application_id: null, document_type: "receipt" }), // other loan's receipt - dropped
    ];
    expect(relevantEarlierVersions(12, docs).map((d) => d.id)).toEqual([1, 4]);
  });
});

describe("backend timestamps", () => {
  it("treats a timestamp with no offset as UTC", () => {
    expect(parseBackendTimestamp("2026-09-26T17:16:50.938430").toISOString()).toBe("2026-09-26T17:16:50.938Z");
    expect(parseBackendTimestamp("2026-09-26T17:16:50+00:00").toISOString()).toBe("2026-09-26T17:16:50.000Z");
    expect(parseBackendTimestamp("2026-09-26T17:16:50Z").toISOString()).toBe("2026-09-26T17:16:50.000Z");
  });

  it("shows times in PNG time regardless of the server's zone", () => {
    expect(formatReviewDateTime("2026-09-26T17:16:50Z")).toBe("Sep 27, 2026, 3:16 AM GMT+10");
    expect(formatReviewDateTime(null)).toBeNull();
    expect(formatReviewDateTime("garbage")).toBeNull();
  });
});
