"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { updateChecklistItem } from "@/lib/actions/checklist";
import {
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_ACTIONS,
  NOTE_MAX_LENGTH,
  evidencePayload,
  needsEvidence,
  noteRequired,
  validateChecklistDraft,
  validateEvidence,
  type EvidenceDraft,
} from "@/lib/checklist";
import { ageFromDob, formatDob, formatReviewDate, formatReviewDateTime } from "@/lib/application-review";
import { statusPresentation } from "@/lib/status-presentation";
import { cn } from "@/lib/utils";
import type { ChecklistItemStatus, ReviewChecklist, ReviewChecklistItem } from "@/lib/types";

// Label, tone and icon come from statusPresentation(); only the row icon's
// shade is this list's own (a lighter grey for "not checked yet").
const ICON_CLASS: Record<ChecklistItemStatus, string> = {
  verified: "text-success",
  failed: "text-danger",
  not_applicable: "text-neutral-400",
  pending: "text-neutral-300",
};

export interface IdDocumentOption {
  id: number;
  label: string; // e.g. "Passport #41"
}

interface ChecklistItemRowProps {
  applicationId: number;
  item: ReviewChecklistItem;
  editable: boolean;
  idDocuments: IdDocumentOption[];
  onSaved: (checklist: ReviewChecklist) => void;
}

function evidenceDraftFrom(item: ReviewChecklistItem): EvidenceDraft {
  return {
    dateOfBirth: item.evidence?.date_of_birth ?? "",
    idDocumentId: item.evidence?.id_document_id ? String(item.evidence.id_document_id) : "",
    idExpiryDate: item.evidence?.id_expiry_date ?? "",
  };
}

// The saved evidence of a verified identity check, as one line.
function evidenceSummary(item: ReviewChecklistItem, idDocuments: IdDocumentOption[]): string | null {
  const e = item.evidence;
  if (item.status !== "verified" || !e) return null;
  if (e.date_of_birth) {
    const age = ageFromDob(e.date_of_birth);
    return `Date of birth ${formatDob(e.date_of_birth)}${age !== null ? ` (age ${age})` : ""}`;
  }
  if (e.id_document_id) {
    const label = idDocuments.find((d) => d.id === e.id_document_id)?.label ?? `ID document #${e.id_document_id}`;
    return e.id_expiry_date ? `${label} · expires ${formatReviewDate(e.id_expiry_date)}` : `${label} · no expiry date`;
  }
  return null;
}

// One checklist item with its own draft, its own Save and its own error -
// saving (or failing to save) one item never touches another's unsaved
// draft.
function ChecklistItemRow({ applicationId, item, editable, idDocuments, onSaved }: ChecklistItemRowProps) {
  const noteId = useId();
  const evidenceId = useId();
  const [evidence, setEvidence] = useState<EvidenceDraft>(() => evidenceDraftFrom(item));
  const [draftStatus, setDraftStatus] = useState<ChecklistItemStatus>(item.status);
  const [draftNote, setDraftNote] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // A saved note reads as plain text; the box only appears while the status
  // is being changed, or after "Add note" / "Edit note".
  const [editingNote, setEditingNote] = useState(false);

  const savedEvidence = evidenceDraftFrom(item);
  const evidenceDirty =
    needsEvidence(item.item_type, draftStatus) &&
    (evidence.dateOfBirth !== savedEvidence.dateOfBirth ||
      evidence.idDocumentId !== savedEvidence.idDocumentId ||
      evidence.idExpiryDate !== savedEvidence.idExpiryDate);
  const dirty = draftStatus !== item.status || draftNote.trim() !== (item.note ?? "") || evidenceDirty;
  const presentation = statusPresentation("checklist", item.status);
  const Icon = presentation.icon;
  const showNote = editable && (editingNote || draftStatus !== item.status);

  function choose(status: ChecklistItemStatus) {
    setDraftStatus(status);
    setError(null);
    setJustSaved(false);
  }

  function cancel() {
    setEditingNote(false);
    setDraftStatus(item.status);
    setDraftNote(item.note ?? "");
    setEvidence(evidenceDraftFrom(item));
    setError(null);
  }

  function setEvidenceField(field: keyof EvidenceDraft, value: string) {
    setEvidence((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setJustSaved(false);
  }

  async function save() {
    const invalid =
      validateChecklistDraft(draftStatus, draftNote) ?? validateEvidence(item.item_type, draftStatus, evidence);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateChecklistItem(
      applicationId,
      item.item_type,
      draftStatus,
      draftNote,
      evidencePayload(item.item_type, draftStatus, evidence),
    );
    setSaving(false);
    if (result.ok) {
      const saved = result.checklist.items.find((i) => i.item_type === item.item_type);
      setDraftStatus(saved?.status ?? draftStatus);
      setDraftNote(saved?.note ?? "");
      if (saved) setEvidence(evidenceDraftFrom(saved));
      setJustSaved(true);
      setEditingNote(false);
      onSaved(result.checklist);
    } else {
      setError(result.error);
    }
  }

  return (
    <li className="py-4 first:pt-2">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICON_CLASS[item.status] ?? ICON_CLASS.pending)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-neutral-900">{item.label}</p>
            {item.required ? (
              <Badge variant="primary">Required</Badge>
            ) : (
              <Badge variant="neutral">Optional for this application</Badge>
            )}
            <Badge variant={presentation.tone}>{presentation.label}</Badge>
            {justSaved && !dirty && (
              <span role="status" className="text-xs font-medium text-success">
                Saved
              </span>
            )}
          </div>

          {(item.checked_by_name || item.checked_at) && (
            <p className="mt-1 text-xs text-neutral-600">
              {presentation.label}
              {item.checked_by_name ? ` by ${item.checked_by_name}` : ""}
              {item.checked_at ? `, ${formatReviewDateTime(item.checked_at)}` : ""}
            </p>
          )}
          {evidenceSummary(item, idDocuments) && (
            <p className="mt-0.5 text-xs text-neutral-700">{evidenceSummary(item, idDocuments)}</p>
          )}
          {item.note && !showNote && (
            <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">&ldquo;{item.note}&rdquo;</p>
          )}
          {editable && !showNote && (
            <button
              type="button"
              onClick={() => {
                setEditingNote(true);
                setJustSaved(false);
              }}
              className="mt-1 rounded text-xs font-medium text-primary hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {item.note ? "Edit note" : "Add note"}
            </button>
          )}

          {editable && (
            <div className="mt-3">
              <div role="radiogroup" aria-label={`${item.label} status`} className="flex flex-wrap gap-2">
                {CHECKLIST_STATUSES.map((s) => {
                  const active = draftStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={saving}
                      onClick={() => choose(s)}
                      className={cn(
                        "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                        active
                          ? "border-primary bg-primary-light text-primary-dark"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                      )}
                    >
                      {CHECKLIST_STATUS_ACTIONS[s]}
                    </button>
                  );
                })}
              </div>

              {showNote && needsEvidence(item.item_type, draftStatus) && item.item_type === "age_18_plus" && (
                <div className="mt-3 flex flex-col gap-1">
                  <label htmlFor={evidenceId} className="text-xs font-medium text-neutral-700">
                    Date of birth on the ID (required)
                  </label>
                  <input
                    id={evidenceId}
                    type="date"
                    value={evidence.dateOfBirth}
                    disabled={saving}
                    onChange={(e) => setEvidenceField("dateOfBirth", e.target.value)}
                    className="w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              )}
              {showNote && needsEvidence(item.item_type, draftStatus) && item.item_type === "valid_id" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={evidenceId} className="text-xs font-medium text-neutral-700">
                      ID document checked (required)
                    </label>
                    <select
                      id={evidenceId}
                      value={evidence.idDocumentId}
                      disabled={saving}
                      onChange={(e) => setEvidenceField("idDocumentId", e.target.value)}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <option value="">
                        {idDocuments.length ? "Choose the ID document" : "No ID document uploaded"}
                      </option>
                      {idDocuments.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${evidenceId}-expiry`} className="text-xs font-medium text-neutral-700">
                      ID expiry date (if it has one)
                    </label>
                    <input
                      id={`${evidenceId}-expiry`}
                      type="date"
                      value={evidence.idExpiryDate}
                      disabled={saving}
                      onChange={(e) => setEvidenceField("idExpiryDate", e.target.value)}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                </div>
              )}

              {showNote && (
                <div className="mt-3 flex flex-col gap-1">
                  <label htmlFor={noteId} className="text-xs font-medium text-neutral-700">
                    Note {noteRequired(draftStatus) ? "(required)" : "(optional)"}
                  </label>
                  <textarea
                    id={noteId}
                    rows={2}
                    maxLength={NOTE_MAX_LENGTH}
                    value={draftNote}
                    disabled={saving}
                    onChange={(e) => {
                      setDraftNote(e.target.value);
                      setError(null);
                      setJustSaved(false);
                    }}
                    placeholder={
                      draftStatus === "failed"
                        ? "What's wrong?"
                        : draftStatus === "not_applicable"
                          ? "Why doesn't this apply?"
                          : "e.g. what you checked it against"
                    }
                    className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              {dirty && (
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
                    Cancel
                  </Button>
                  <span className="text-xs text-neutral-500">Unsaved</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

interface VerificationChecklistProps {
  applicationId: number;
  initial: ReviewChecklist;
  editable: boolean;
  lockedReason: string;
  // The customer's current ID documents, for the Valid ID check.
  idDocuments?: IdDocumentOption[];
}

export function VerificationChecklist({
  applicationId,
  initial,
  editable,
  lockedReason,
  idDocuments = [],
}: VerificationChecklistProps) {
  const router = useRouter();
  const [checklist, setChecklist] = useState(initial);
  const { summary } = checklist;
  const labelOf = (key: string) => checklist.items.find((i) => i.item_type === key)?.label ?? key;

  function handleSaved(next: ReviewChecklist) {
    setChecklist(next);
    // Re-render the server-rendered panels (document check badges) so
    // they agree with what was just saved. Client state here survives it.
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Verification checklist</CardTitle>
          {checklist.started && (
            <p className="mt-1 text-sm text-neutral-600">
              {summary.required_complete} of {summary.required} required checks done. Each check saves on its own.
            </p>
          )}
        </div>
        {checklist.started &&
          (summary.ready_for_approval_recommendation ? (
            <Badge variant="success">All required checks done</Badge>
          ) : (
            <Badge variant="warning">
              {summary.blocking_items.length} {summary.blocking_items.length === 1 ? "check" : "checks"} outstanding
            </Badge>
          ))}
      </div>

      {!editable && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          {lockedReason}
        </p>
      )}

      {!checklist.started ? null : (
        <>
          {summary.blocking_items.length > 0 && (
            <p className="mt-3 text-xs text-neutral-600">
              Outstanding before an approval recommendation: {summary.blocking_items.map(labelOf).join(", ")}.
            </p>
          )}
          <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
            {checklist.items.map((item) => (
              <ChecklistItemRow
                key={item.item_type}
                applicationId={applicationId}
                item={item}
                editable={editable}
                idDocuments={idDocuments}
                onSaved={handleSaved}
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
