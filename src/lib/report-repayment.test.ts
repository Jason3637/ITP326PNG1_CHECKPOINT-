import { describe, expect, it } from "vitest";
import { methodLabel, REPAYMENT_METHODS } from "./report-repayment";

// The filename-encoding workaround this file used to test (buildReceiptFilename
// / generatePlaceholderReceiptImage) is gone - POST /api/payments/repay now
// accepts amount/payment_date/payment_method/reference_number directly as
// structured fields (see app/services/payment_processing.py), so none of that
// data needs to travel encoded into an uploaded file's name anymore.
describe("methodLabel", () => {
  it("maps every REPAYMENT_METHODS value to its label", () => {
    for (const { value, label } of REPAYMENT_METHODS) {
      expect(methodLabel(value)).toBe(label);
    }
  });

  it("falls back to the raw value for an unrecognized method", () => {
    // @ts-expect-error - deliberately passing a value outside the union
    expect(methodLabel("unknown")).toBe("unknown");
  });
});
