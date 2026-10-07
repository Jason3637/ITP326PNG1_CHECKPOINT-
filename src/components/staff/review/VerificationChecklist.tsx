"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, MessageSquarePlus, StickyNote } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { RequestInformationButton } from "./RequestInformationButton";
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

// "default": the original layout (the administrator's read-only view).
// "compact": one line per check with a segmented control - the officer's.
// Both share the row's state, validation and save.
export type ChecklistVariant = "default" | "compact";

interface ChecklistItemRowProps {
  applicationId: number;
  item: ReviewChecklistItem;
  editable: boolean;
  idDocuments: IdDocumentOption[];
  onSaved: (checklist: ReviewChecklist) => void;
  variant: ChecklistVariant;
  hidden?: boolean;
}

// The state words in the compact row, coloured by tone (the icon and words
// carry the meaning; colour repeats it).
const TONE_TEXT = {
  success: "text-success",
  danger: "text-red-700",
  warning: "text-amber-800",
  info: "text-info",
  neutral: "text-neutral-600",
} as const;

const STATUS_OPTIONS = CHECKLIST_STATUSES.map((s) => ({ value: s, label: CHECKLIST_STATUS_ACTIONS[s] }));

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
function ChecklistItemRow({ applicationId, item, editable, idDocuments, onSaved, variant, hidden }: ChecklistItemRowProps) {
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
    let result: Awaited<ReturnType<typeof updateChecklistItem>>;
    try {
      result = await updateChecklistItem(
        applicationId,
        item.item_type,
        draftStatus,
        draftNote,
        evidencePayload(item.item_type, draftStatus, evidence),
      );
    } catch {
      // The request itself failed (offline, server unreachable) - nothing
      // was saved. Keep the draft and say so, rather than spin forever.
      result = { ok: false, error: "Couldn't reach the server. Check your connection, then save again." };
    }
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

  // The editor under a row: the identity-check evidence, the note, the
  // error and Save/Cancel. Shared by both layouts.
  const editorFields = (
    <>
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
    </>
  );

  if (variant === "compact") {
    const problem = item.status === "failed" || draftStatus === "failed";
    const checkedBy =
      item.checked_by_name || item.checked_at
        ? `${presentation.label}${item.checked_by_name ? ` by ${item.checked_by_name}` : ""}${item.checked_at ? `, ${formatReviewDateTime(item.checked_at)}` : ""}`
        : null;
    const details = [evidenceSummary(item, idDocuments), checkedBy].filter(Boolean).join(" · ");
    const noteLabel = item.note ? "Edit note" : "Add note";
    return (
      <li hidden={hidden} className="py-2.5">
        {/* One control per row, placed by the grid: on a narrow card the label
            and note button share the top line and the status strip runs full
            width below; from @xl it's all one line. DOM (and tab) order stays
            label, status, note. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 @xl:grid-cols-[minmax(0,1fr)_auto_auto] @xl:items-center">
          <div className="col-start-1 row-start-1 flex min-w-0 items-start gap-3">
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICON_CLASS[item.status] ?? ICON_CLASS.pending)} aria-hidden="true" />
            <div className="min-w-0">
              {/* Read as "Valid ID checked: Verified, required". */}
              <p className="text-sm font-medium text-neutral-900">
                {item.label}
                <span className="sr-only">
                  : {presentation.label}, {item.required ? "required" : "optional"}
                </span>
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs" aria-hidden="true">
                <span className={cn("font-semibold uppercase tracking-wide", item.required ? "text-primary-dark" : "text-neutral-500")}>
                  {item.required ? "Required" : "Optional"}
                </span>
                <span className="text-neutral-300">·</span>
                <span className={cn("font-medium", TONE_TEXT[presentation.tone])}>{presentation.label}</span>
              </p>
            </div>
          </div>
          {editable && (
            <>
              <SegmentedControl
                label={`${item.label} status`}
                options={STATUS_OPTIONS}
                value={draftStatus}
                onChange={choose}
                disabled={saving}
                // Four equal segments across a narrow card; a strip when there's room.
                className="col-span-2 row-start-2 grid grid-cols-4 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1 @xl:inline-flex"
                // Narrow: no check icon, so "Unchecked" fits; bold, tint and shadow
                // still mark the chosen one (and aria-checked).
                itemClassName="px-1 text-xs pointer-coarse:px-1 [&_svg]:hidden @xl:px-2.5 @xl:text-sm @xl:pointer-coarse:px-3.5 @xl:[&_svg]:inline-block"
              />
              {!showNote && (
                <button
                  type="button"
                  aria-label={noteLabel}
                  title={noteLabel}
                  onClick={() => {
                    setEditingNote(true);
                    setJustSaved(false);
                  }}
                  className={cn(
                    "col-start-2 row-start-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg pointer-coarse:h-11 pointer-coarse:w-11 @xl:col-start-3",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    // On a problem the note is the explanation - make it stand out.
                    problem
                      ? "border border-danger/40 bg-danger-light/50 text-red-700 hover:bg-danger-light"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-primary-dark",
                  )}
                >
                  <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>

        {details && <p className="mt-1 pl-8 text-xs text-neutral-500">{details}</p>}
        {item.note && !showNote && (
          <p
            className={cn(
              "mt-1.5 ml-8 flex items-start gap-1.5 rounded-md px-2 py-1 text-sm",
              item.status === "failed" ? "bg-danger-light/60 text-neutral-900" : "bg-neutral-50 text-neutral-700",
            )}
          >
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
            <span className="sr-only">Note: </span>
            <span className="line-clamp-2 whitespace-pre-line">&ldquo;{item.note}&rdquo;</span>
          </p>
        )}
        {editable && showNote && <div className="pl-8">{editorFields}</div>}
        {/* This row's save progress, announced politely; empty when idle. */}
        <p role="status" className="mt-1 pl-8 text-xs font-medium empty:hidden">
          {saving ? (
            <span className="text-neutral-600">Saving…</span>
          ) : justSaved && !dirty ? (
            <span className="text-success">Saved</span>
          ) : null}
        </p>
      </li>
    );
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

              {editorFields}
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
  // See ChecklistVariant. The administrator's page keeps "default".
  variant?: ChecklistVariant;
  // Compact only: offer "Request more information" in the header (opens the
  // request dialog - RequestInformationButton). Only when the backend allows it.
  offerRequestInformation?: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function VerificationChecklist({
  applicationId,
  initial,
  editable,
  lockedReason,
  idDocuments = [],
  variant = "default",
  offerRequestInformation = false,
}: VerificationChecklistProps) {
  const router = useRouter();
  const [checklist, setChecklist] = useState(initial);
  // Compact only: null shows every check; otherwise the checks that needed
  // attention when the filter was chosen. Fixed at that moment, so a check
  // saved as verified stays in view (with its "Saved") until the filter is
  // chosen again. Rows are hidden, not removed, so drafts survive.
  const [attentionKeys, setAttentionKeys] = useState<Set<string> | null>(null);
  const { summary } = checklist;
  const labelOf = (key: string) => checklist.items.find((i) => i.item_type === key)?.label ?? key;

  function handleSaved(next: ReviewChecklist) {
    setChecklist(next);
    // Re-render the server-rendered panels (document check badges) so
    // they agree with what was just saved. Client state here survives it.
    router.refresh();
  }

  if (variant === "compact") {
    const items = checklist.items;
    const count = (status: ChecklistItemStatus) => items.filter((i) => i.status === status).length;
    const needsAttention = items.filter((i) => summary.blocking_items.includes(i.item_type) || i.status === "failed");
    const filterButton = (label: string, active: boolean, onClick: () => void) => (
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium pointer-coarse:h-11",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active
            ? "border-primary bg-primary-light text-primary-dark"
            : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
        )}
      >
        {label}
      </button>
    );

    return (
      <Card className="@container">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <CardTitle>Verification checklist</CardTitle>
          {offerRequestInformation && <RequestInformationButton />}
        </div>
        {checklist.started && (
          <p className="mt-1 text-sm text-neutral-600">
            {summary.required} required · {count("verified")} verified · {plural(count("failed"), "problem")} ·{" "}
            {count("pending")} not checked yet · {count("not_applicable")} N/A. Each check saves on its own.
          </p>
        )}

        {!editable && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
            {lockedReason}
          </p>
        )}

        {checklist.started && (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label="Show checks" className="flex flex-wrap gap-2">
                {filterButton("All", attentionKeys === null, () => setAttentionKeys(null))}
                {filterButton(`Needs attention (${needsAttention.length})`, attentionKeys !== null, () =>
                  setAttentionKeys(new Set(needsAttention.map((i) => i.item_type))),
                )}
              </div>
              {summary.ready_for_approval_recommendation ? (
                <Badge variant="success">All required checks done</Badge>
              ) : (
                <Badge variant="warning">{plural(summary.blocking_items.length, "check")} outstanding</Badge>
              )}
            </div>
            {summary.blocking_items.length > 0 && (
              <p className="mt-2 text-xs text-neutral-600">
                Outstanding before an approval recommendation: {summary.blocking_items.map(labelOf).join(", ")}.
              </p>
            )}
            {attentionKeys !== null && attentionKeys.size === 0 && (
              <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">Nothing needs attention.</p>
            )}
            <ul className="mt-1 flex flex-col divide-y divide-neutral-100">
              {items.map((item) => (
                <ChecklistItemRow
                  key={item.item_type}
                  applicationId={applicationId}
                  item={item}
                  editable={editable}
                  idDocuments={idDocuments}
                  onSaved={handleSaved}
                  variant="compact"
                  hidden={attentionKeys !== null && !attentionKeys.has(item.item_type)}
                />
              ))}
            </ul>
          </>
        )}
      </Card>
    );
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
                variant="default"
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
