// Payment method options shown on the Report Repayment form. Sent directly
// as `payment_method` to POST /api/payments/repay (a free-form string on
// the backend, per app/models/payment_transaction.py's comment - not yet a
// fixed enum there, so any string works, but this UI still offers a
// closed set for consistency).
export type RepaymentMethod = "bsp_mobile_banking" | "cash" | "other";

export const REPAYMENT_METHODS: { value: RepaymentMethod; label: string }[] = [
  { value: "bsp_mobile_banking", label: "BSP Mobile Banking" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export function methodLabel(method: RepaymentMethod) {
  return REPAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}
