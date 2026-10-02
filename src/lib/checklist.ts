import type {
  ChecklistItemStatus,
  ReviewChecklist,
  ReviewChecklistItem,
  ReviewDocument,
  ReviewInformationRequest,
} from "./types";

export const CHECKLIST_STATUSES: ChecklistItemStatus[] = ["verified", "failed", "not_applicable", "pending"];

export const CHECKLIST_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  verified: "Verified",
  failed: "Problem found",
  not_applicable: "Not applicable",
  pending: "Not checked yet",
};

// Shorter labels for the per-item buttons.
export const CHECKLIST_STATUS_ACTIONS: Record<ChecklistItemStatus, string> = {
  verified: "Verified",
  failed: "Problem",
  not_applicable: "N/A",
  pending: "Unchecked",
};

// Mirrors the backend's rule (verification._NOTE_REQUIRED) so the officer
// is told before saving rather than after a 400 - the backend still
// enforces it either way.
export function noteRequired(status: ChecklistItemStatus): boolean {
  return status === "failed" || status === "not_applicable";
}

export const NOTE_MAX_LENGTH = 1000;

export function validateChecklistDraft(status: ChecklistItemStatus, note: string): string | null {
  const trimmed = note.trim();
  if (noteRequired(status) && !trimmed) {
    return status === "failed" ? "Add a note saying what the problem is." : "Add a note saying why this doesn't apply.";
  }
  if (trimmed.length > NOTE_MAX_LENGTH) return `Keep the note under ${NOTE_MAX_LENGTH} characters.`;
  return null;
}

export function isChecklistStatus(value: unknown): value is ChecklistItemStatus {
  return typeof value === "string" && (CHECKLIST_STATUSES as string[]).includes(value);
}

// Why the checklist is read-only for this viewer. Whether it IS editable
// always comes from the backend's allowed_actions ("update_checklist");
// this only picks the explanation to show alongside.
export function checklistLockedReason(opts: {
  started: boolean;
  status: string;
  isMine: boolean;
  officerName: string | null;
}): string {
  if (!opts.started || opts.status === "submitted") {
    return "Checks start once an officer claims this application.";
  }
  if (opts.status === "returned_to_officer") {
    return "Returned by the administrator. Resume the review to update checks.";
  }
  if (["recommended_for_approval", "recommended_for_rejection", "admin_review"].includes(opts.status)) {
    return "Locked while the recommendation is with the administrator.";
  }
  if (!opts.isMine) {
    return opts.officerName
      ? `Assigned to ${opts.officerName}. Only they or an administrator can update these checks.`
      : "Only the assigned officer or an administrator can update these checks.";
  }
  return "Checks can't be changed at this stage.";
}

export interface DocumentProvenance {
  requestId: number;
  reason: string;
  respondedAt: string | null;
}

// Which request-more-information round each document was provided in,
// from the backend's own link (InformationResponse.provided_document_ids).
export function documentProvenance(requests: ReviewInformationRequest[]): Map<number, DocumentProvenance> {
  const map = new Map<number, DocumentProvenance>();
  for (const r of requests) {
    for (const id of r.response?.provided_document_ids ?? []) {
      // First (earliest) round that provided it wins - a document id is
      // only uploaded once, so a repeat would be the same upload re-cited.
      if (!map.has(id)) map.set(id, { requestId: r.id, reason: r.reason, respondedAt: r.response?.responded_at ?? null });
    }
  }
  return map;
}

// Open requests still waiting on a specific document type.
export function awaitedDocumentTypes(requests: ReviewInformationRequest[]): Set<string> {
  return new Set(
    requests.filter((r) => r.status === "open" && r.required_document_type).map((r) => r.required_document_type!),
  );
}

// For an earlier version: the document that replaced it, if it's one we
// have (current documents for this application, or another earlier one).
export function replacementOf(doc: ReviewDocument, all: ReviewDocument[]): ReviewDocument | null {
  if (doc.superseded_by_id === null) return null;
  return all.find((d) => d.id === doc.superseded_by_id) ?? null;
}

// Copies only the fields the checklist UI renders. The checklist goes to a
// client component (initial render and every save result), so nothing else
// from the backend's checklist payload (checker user ids,
// customer_verification_id) is serialized to the browser.
export function pickChecklist(raw: ReviewChecklist): ReviewChecklist {
  return {
    started: raw.started,
    items: raw.items.map(
      (i): ReviewChecklistItem => ({
        item_type: i.item_type,
        label: i.label,
        required: i.required,
        status: i.status,
        note: i.note,
        checked_by_name: i.checked_by_name,
        checked_at: i.checked_at,
      }),
    ),
    summary: {
      required: raw.summary.required,
      required_complete: raw.summary.required_complete,
      failed: raw.summary.failed,
      blocking_items: raw.summary.blocking_items,
      ready_for_approval_recommendation: raw.summary.ready_for_approval_recommendation,
    },
  };
}
