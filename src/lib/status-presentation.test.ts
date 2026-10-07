import { describe, expect, it } from "vitest";
import { Circle } from "lucide-react";
import { statusPresentation } from "./status-presentation";
import { TONE_ICONS, statusTone } from "./status-tone";
import { CHECKLIST_STATUS_LABELS } from "./checklist";
import { staffStatusLabel } from "./officer-queues";

describe("statusPresentation", () => {
  it("shows application statuses with the staff label and statusTone's colour", () => {
    for (const s of ["submitted", "officer_review", "customer_action_required", "returned_to_officer", "approved", "rejected"]) {
      const p = statusPresentation("application", s);
      expect(p.label).toBe(staffStatusLabel(s));
      expect(p.tone).toBe(statusTone(s));
      expect(p.icon).toBe(TONE_ICONS[p.tone]);
    }
  });

  it("shows checklist items as the review screen always has", () => {
    expect(statusPresentation("checklist", "verified")).toMatchObject({ label: CHECKLIST_STATUS_LABELS.verified, tone: "success" });
    expect(statusPresentation("checklist", "failed")).toMatchObject({ label: "Problem found", tone: "danger" });
    expect(statusPresentation("checklist", "not_applicable")).toMatchObject({ tone: "neutral", icon: TONE_ICONS.neutral });
    // Not checked yet is grey (not the amber statusTone gives "pending"),
    // and an empty circle so it isn't confused with "not applicable".
    expect(statusPresentation("checklist", "pending")).toEqual({ label: "Not checked yet", tone: "neutral", icon: Circle });
  });

  it("shows information requests by whether the customer still owes an answer", () => {
    expect(statusPresentation("informationRequest", "open")).toMatchObject({ label: "Waiting on customer", tone: "warning" });
    expect(statusPresentation("informationRequest", "responded")).toMatchObject({ label: "Answered", tone: "success" });
    expect(statusPresentation("informationRequest", "cancelled")).toMatchObject({ label: "Cancelled", tone: "neutral" });
  });

  it("shows recommendations in recommend-only words", () => {
    expect(statusPresentation("recommendation", "recommend_approval")).toMatchObject({ label: "Recommended approval", tone: "success" });
    expect(statusPresentation("recommendation", "recommend_rejection")).toMatchObject({ label: "Recommended rejection", tone: "danger" });
  });

  it("falls back safely for values it doesn't know, including inherited object keys", () => {
    expect(statusPresentation("checklist", "constructor")).toMatchObject({ label: "Not checked yet", tone: "neutral" });
    expect(statusPresentation("informationRequest", "toString")).toMatchObject({ label: "Waiting on customer", tone: "warning" });
    expect(statusPresentation("recommendation", "something_new")).toMatchObject({ label: "Recommendation", tone: "neutral" });
    expect(statusPresentation("application", "something_new")).toMatchObject({ label: "In progress", tone: "neutral" });
  });

  it("always gives words and an icon, never colour alone", () => {
    const domains = ["application", "checklist", "informationRequest", "recommendation"] as const;
    for (const d of domains)
      for (const s of ["open", "verified", "submitted", "recommend_approval", "x"]) {
        const p = statusPresentation(d, s);
        expect(p.label.length).toBeGreaterThan(0);
        expect(p.icon).toBeTruthy();
      }
  });
});
