import { describe, expect, it } from "vitest";
import { primeRangeMessage } from "./prime-range";

describe("primeRangeMessage", () => {
  it("takes the range from the backend, so it follows pricing changes", () => {
    expect(primeRangeMessage("amount_requested must be between K100 and K1,000. Loans above K1,000 are ...")).toBe(
      "PRIME loans are available from K100 to K1,000, in whole Kina.",
    );
    expect(primeRangeMessage("amount_requested must be between K50 and K1,500. Loans above K1,500 are ...")).toBe(
      "PRIME loans are available from K50 to K1,500, in whole Kina.",
    );
  });

  it("explains whole-Kina amounts, and falls back without inventing a range", () => {
    expect(primeRangeMessage("amount_requested must be a whole-Kina amount (no toea).")).toBe("Enter a whole-Kina amount (no toea).");
    expect(primeRangeMessage("something else")).toBe("Enter an amount within the PRIME loan range, in whole Kina.");
  });
});
