import type { DisbursementMethod } from "./types";

// Recording a disbursement - exactly the fields the backend's design takes
// (POST /admin/applications/<id>/disbursement):
//   method              bsp_mobile_banking | cash_on_hand
//   reference           required for both: the BSP transaction number, or
//                       the cash acknowledgement number
//   disbursed_at        optional, when the money moved (default now; never
//                       in the future or before the approval)
//   evidence_document_id the BSP receipt (REQUIRED for BSP -
//                       PRIMESTONE's rule) or the signed cash acknowledgement
//                       (optional), uploaded first
//   note                optional
// The destination isn't entered: for BSP the backend masks the account the
// customer gave on their application and stores that.
export const REFERENCE_MAX_LENGTH = 255;
export const NOTE_MAX_LENGTH = 500;

export interface DisbursementInput {
  method: DisbursementMethod;
  reference: string;
  disbursedAt: string; // datetime-local value (Port Moresby wall-clock), or "" for now
  note: string;
}

export function isDisbursementMethod(value: unknown): value is DisbursementMethod {
  return value === "bsp_mobile_banking" || value === "cash_on_hand";
}

// The same mask the backend stores (loan_processing._mask): the last four
// characters only. Shown so the admin can check where the money goes.
export function maskAccount(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? `•••• ${v.slice(-4)}` : null;
}

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

// Every BSP payout must carry its receipt; a cash acknowledgement is optional.
export function evidenceRequired(method: DisbursementMethod): boolean {
  return method === "bsp_mobile_banking";
}

export function validateDisbursement(input: DisbursementInput, hasEvidence = true): string | null {
  if (!isDisbursementMethod(input.method)) return "Choose how the money was paid out.";
  if (evidenceRequired(input.method) && !hasEvidence) return DISBURSEMENT_COPY.methods[input.method].evidenceRequired;
  const reference = input.reference.trim();
  if (!reference) return DISBURSEMENT_COPY.methods[input.method].referenceRequired;
  if (reference.length > REFERENCE_MAX_LENGTH) return `Keep the reference under ${REFERENCE_MAX_LENGTH} characters.`;
  if (input.disbursedAt && !LOCAL_DATETIME.test(input.disbursedAt)) return "Enter the date and time the money moved.";
  if (input.note.trim().length > NOTE_MAX_LENGTH) return `Keep the note under ${NOTE_MAX_LENGTH} characters.`;
  return null;
}

export const DISBURSEMENT_COPY = {
  title: "Record disbursement",
  intro:
    "Record the payout once the money has actually moved. The loan becomes active only when this is saved.",
  methods: {
    bsp_mobile_banking: {
      label: "BSP Mobile Banking",
      help: "Paid into the customer's BSP account.",
      referenceLabel: "BSP transaction number",
      referencePlaceholder: "e.g. BSP-TXN-88213",
      referenceRequired: "Enter the BSP transaction number.",
      evidenceLabel: "BSP receipt or screenshot",
      evidenceRequired: "Attach the BSP receipt or screenshot - every BSP payout needs one.",
    },
    cash_on_hand: {
      label: "Cash on Hand",
      help: "Handed over in cash at the office.",
      referenceLabel: "Cash acknowledgement number",
      referencePlaceholder: "e.g. CASH-ACK-0042",
      referenceRequired: "Enter the cash acknowledgement number.",
      evidenceLabel: "Signed cash acknowledgement",
      evidenceRequired: "",
    },
  } satisfies Record<DisbursementMethod, Record<string, string>>,
  evidenceHint: "PDF, JPG or PNG, up to 10 MB.",
  disbursedAtLabel: "When the money moved (Port Moresby time)",
  disbursedAtHint: "Leave blank if it moved just now.",
  noteLabel: "Note",
  review: "Review disbursement",
  confirmTitle: "Record this disbursement?",
  confirmBody: "This creates the loan and starts its 14-day term. It can't be undone or recorded twice.",
  confirm: "Record disbursement",
  back: "Back",
  uploading: "Uploading evidence…",
  saving: "Recording disbursement…",
};
