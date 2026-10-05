import { describe, expect, it } from "vitest";
import { plainDefinition } from "./plain-definition";

describe("plainDefinition", () => {
  it("rewords the backend's developer phrasing", () => {
    expect(plainDefinition("approved / (approved + rejected), decisions in the window; null if none.")).toBe(
      "Approved ÷ (approved + rejected), for decisions in the period. Shows — when there were none.",
    );
    expect(plainDefinition("Applications given a final APPROVE decision in the window.")).toBe(
      "Applications given a final approval in the period.",
    );
    expect(plainDefinition("Outstanding balance on those overdue loans (as of now).")).toBe(
      "Outstanding balance on those overdue loans (right now).",
    );
  });

  it("leaves plain definitions alone", () => {
    expect(plainDefinition("Loans disbursed.")).toBe("Loans disbursed.");
  });
});
